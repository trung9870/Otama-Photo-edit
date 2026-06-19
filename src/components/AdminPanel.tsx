import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage, storageRef, deleteObject } from '../firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase';
import { UserPlus, Shield, Eye, EyeOff, Users, Shirt, Grid3x3, ImageIcon, DollarSign, MousePointerClick, Sparkles, Wand2, Wallet, RotateCw, Clock, Download, Trash2, ZoomIn } from 'lucide-react';
import { Button, Pill, Switch, Segmented } from './ui';

const FEATURE_LABELS: Record<string, string> = {
  'clothing-gen': 'Quần áo · Gen',
  'analyze': 'Quần áo · Phân tích',
  'ecom-gen-new': 'Ecom · Gen new',
  'ecom-clone': 'Ecom · Clone',
  'ecom-pattern': 'Ecom · Pattern',
  'ecom-enhance': 'Ecom · Tách/Enhance',
  'ecom-thay': 'Ecom · Thay',
  'ecom-compose': 'Ecom · Ghép ảnh',
};
const MODEL_LABELS: Record<string, string> = {
  'nano-banana-pro': 'Banana Pro',
  'nano-banana-2': 'Banana 2',
  'gemini-3-pro-image-preview': 'Banana Pro (Google)',
  'gemini-3.1-flash-image-preview': 'Banana 2 (Google)',
  'gpt-image-2-image-to-image': 'GPT2 (Kie)',
  'gemini-3-flash-preview': 'Phân tích (text)',
};

export default function AdminPanel({ currentUser }: { currentUser: any }) {
  const [adminTab, setAdminTab] = useState<'users' | 'stats' | 'history'>('users');
  const [history, setHistory] = useState<any[]>([]);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'7d' | '15d' | '30d' | 'custom'>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [kieCredits, setKieCredits] = useState<number | null>(null);
  const [kieCreditsLoading, setKieCreditsLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New user form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data()));
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe usage logs only when on stats tab
  useEffect(() => {
    if (adminTab !== 'stats') return;
    const unsub = onSnapshot(collection(db, 'usage'), (snap) => {
      setUsage(snap.docs.map(d => d.data()));
    }, (err) => console.warn('usage subscribe error', err));
    return () => unsub();
  }, [adminTab]);

  // Lấy số dư credit Kie.ai khi vào tab Thống kê
  const fetchKieCredits = async () => {
    setKieCreditsLoading(true);
    try {
      const r = await fetch('/api/kie-credits');
      const data = await r.json();
      setKieCredits(typeof data.credits === 'number' ? data.credits : null);
    } catch (e) {
      console.warn('fetch kie credits failed', e);
    } finally {
      setKieCreditsLoading(false);
    }
  };
  useEffect(() => {
    if (adminTab === 'stats') fetchKieCredits();
  }, [adminTab]);

  // Lịch sử ảnh đã gen
  useEffect(() => {
    if (adminTab !== 'history') return;
    const unsub = onSnapshot(collection(db, 'history'), (snap) => {
      const items = snap.docs.map(d => d.data());
      items.sort((a, b) => {
        const ta = a.ts?.toMillis ? a.ts.toMillis() : (a.ts?.seconds || 0) * 1000;
        const tb = b.ts?.toMillis ? b.ts.toMillis() : (b.ts?.seconds || 0) * 1000;
        return tb - ta;
      });
      setHistory(items);
    }, (err) => console.warn('history subscribe error', err));
    return () => unsub();
  }, [adminTab]);

  const deleteHistoryItem = async (item: any) => {
    if (!window.confirm('Xóa ảnh này khỏi lịch sử?')) return;
    try {
      if (item.path) await deleteObject(storageRef(storage, item.path)).catch(() => {});
      await deleteDoc(doc(db, 'history', item.id));
    } catch (e) {
      console.warn('delete history failed', e);
    }
  };

  const analytics = useMemo(() => {
    // Lọc theo thời gian dựa trên ts (Firestore Timestamp)
    const now = Date.now();
    const tsMillis = (u: any) => {
      const t = u.ts;
      if (!t) return 0;
      if (typeof t.toMillis === 'function') return t.toMillis();
      if (typeof t.seconds === 'number') return t.seconds * 1000;
      return 0;
    };
    let lo = 0;
    let hi = Infinity;
    if (timeFilter === '7d') lo = now - 7 * 24 * 3600 * 1000;
    else if (timeFilter === '15d') lo = now - 15 * 24 * 3600 * 1000;
    else if (timeFilter === '30d') lo = now - 30 * 24 * 3600 * 1000;
    else if (timeFilter === 'custom') {
      if (customFrom) lo = new Date(customFrom + 'T00:00:00').getTime();
      if (customTo) hi = new Date(customTo + 'T23:59:59').getTime();
    }
    const inRange = usage.filter(u => { const m = tsMillis(u); return m >= lo && m <= hi; });
    const gens = inRange.filter(u => u.type === 'gen');
    const views = inRange.filter(u => u.type === 'view');
    // Theo ngày (cho biểu đồ)
    const byDay: Record<string, { count: number; cost: number }> = {};
    gens.forEach(g => {
      const d = new Date(tsMillis(g));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = byDay[key] || { count: 0, cost: 0 };
      byDay[key].count += g.count || 0;
      byDay[key].cost += g.cost || 0;
    });
    const totalImages = gens.reduce((s, g) => s + (g.count || 0), 0);
    const totalCost = gens.reduce((s, g) => s + (g.cost || 0), 0);
    const totalCredits = gens.reduce((s, g) => s + (g.credits || 0), 0);
    const byModel: Record<string, { count: number; cost: number }> = {};
    // Chi tiết: model → size → { count, cost }
    const byModelSize: Record<string, Record<string, { count: number; cost: number }>> = {};
    const byFeature: Record<string, number> = {};
    const byUser: Record<string, { count: number; cost: number }> = {};
    const byView: Record<string, number> = {};
    gens.forEach(g => {
      const m = g.model || 'unknown';
      const size = (g.size || '—').toString().toUpperCase();
      byModel[m] = byModel[m] || { count: 0, cost: 0 };
      byModel[m].count += g.count || 0;
      byModel[m].cost += g.cost || 0;
      byModelSize[m] = byModelSize[m] || {};
      byModelSize[m][size] = byModelSize[m][size] || { count: 0, cost: 0 };
      byModelSize[m][size].count += g.count || 0;
      byModelSize[m][size].cost += g.cost || 0;
      byFeature[g.feature || 'unknown'] = (byFeature[g.feature || 'unknown'] || 0) + (g.count || 0);
      const u = g.email || 'ẩn danh';
      byUser[u] = byUser[u] || { count: 0, cost: 0 };
      byUser[u].count += g.count || 0;
      byUser[u].cost += g.cost || 0;
    });
    views.forEach(v => { byView[v.view || 'unknown'] = (byView[v.view || 'unknown'] || 0) + 1; });
    const dailySeries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, v]) => ({ day, ...v }));
    return { totalImages, totalCost, totalCredits, totalViews: views.length, byModel, byModelSize, byFeature, byUser, byView, dailySeries };
  }, [usage, timeFilter, customFrom, customTo]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    clothing: users.filter(u => u.canUseClothing).length,
    ecom: users.filter(u => u.canUseEcom).length,
    ofa: users.filter(u => u.canUseOfa).length,
    picset: users.filter(u => u.canUsePicset).length,
    runninghub: users.filter(u => u.canUseRunninghub).length,
  }), [users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);
    setError(null);
    try {
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        password,
        role: 'user',
        canUseClothing: true,
        canUseEcom: true,
        canUseOfa: true,
        canUsePicset: true,
        canUseRunninghub: true,
        createdAt: new Date(),
      });
      await secondaryAuth.signOut();
      setEmail('');
      setPassword('');
      alert("Tạo tài khoản thành công!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const togglePermission = async (uid: string, field: string, currentValue: boolean) => {
    try {
      await setDoc(doc(db, 'users', uid), { [field]: !currentValue }, { merge: true });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 44,
    padding: '0 14px',
    borderRadius: 10,
    background: 'var(--color-fill)',
    color: 'var(--color-text)',
    fontSize: 14,
    border: '0.5px solid transparent',
    outline: 'none',
    width: '100%',
    letterSpacing: '-0.01em',
  };

  const statCards = [
    { label: 'Tổng người dùng', value: stats.total, icon: Users, color: 'var(--color-accent)' },
    { label: 'Quản trị viên', value: stats.admins, icon: Shield, color: 'var(--color-indigo)' },
    { label: 'Có quyền Quần áo', value: stats.clothing, icon: Shirt, color: 'var(--color-success)' },
    { label: 'Có quyền Ecom', value: stats.ecom, icon: Grid3x3, color: 'var(--color-warning)' },
    { label: 'Có quyền OFA', value: stats.ofa, icon: Sparkles, color: 'var(--color-danger)' },
    { label: 'Có quyền Picset', value: stats.picset, icon: Wand2, color: 'var(--color-accent)' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" style={{ color: 'var(--color-text)' }}>
      <div>
        <h2 className="font-bold flex items-center gap-2" style={{ fontSize: 26, letterSpacing: '-0.03em' }}>
          <Shield style={{ color: 'var(--color-accent)' }} /> Quản trị viên
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 2 }}>
          Quản lý người dùng và phân quyền sử dụng các tính năng.
        </p>
      </div>

      {error && (
        <div
          className="p-4 rounded-xl"
          style={{
            fontSize: 13,
            background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
            border: '0.5px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      <Segmented<'users' | 'stats' | 'history'>
        value={adminTab}
        onChange={(v) => setAdminTab(v)}
        size="lg"
        options={[
          { value: 'users', label: 'Người dùng', icon: Users },
          { value: 'stats', label: 'Thống kê', icon: Sparkles },
          { value: 'history', label: 'Lịch sử', icon: Clock },
        ]}
      />

      {adminTab === 'history' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{history.length} ảnh đã lưu</p>
          </div>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '40px 0' }}>
              Chưa có ảnh nào trong lịch sử. Ảnh sẽ tự lưu sau mỗi lần gen.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {history.map((h) => {
                const d = h.ts?.toMillis ? new Date(h.ts.toMillis()) : h.ts?.seconds ? new Date(h.ts.seconds * 1000) : null;
                return (
                  <div key={h.id} className="relative group overflow-hidden" style={{ background: 'var(--color-card)', borderRadius: 14, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
                    <div className="aspect-square overflow-hidden" style={{ background: 'var(--color-card-secondary)' }}>
                      <img src={h.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-2.5">
                      <p className="font-semibold truncate" style={{ fontSize: 12, color: 'var(--color-text)' }}>{MODEL_LABELS[h.model] || h.model}</p>
                      <p className="truncate" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                        {FEATURE_LABELS[h.feature] || h.feature}{h.size ? ` · ${String(h.size).toUpperCase()}` : ''}
                      </p>
                      <p className="truncate" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {h.email}{d ? ` · ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setZoomUrl(h.url)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', color: '#fff', boxShadow: 'var(--shadow-pop)' }} title="Phóng to"><ZoomIn size={14} /></button>
                      <button onClick={() => { const a = document.createElement('a'); a.href = h.url; a.download = `${h.id}.jpg`; a.target = '_blank'; a.click(); }} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: 'var(--color-accent)', color: '#fff', boxShadow: 'var(--shadow-pop)' }} title="Tải về"><Download size={14} /></button>
                      <button onClick={() => deleteHistoryItem(h)} className="rounded-lg flex items-center justify-center" style={{ width: 28, height: 28, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', color: '#fff', boxShadow: 'var(--shadow-pop)' }} title="Xóa"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {zoomUrl && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setZoomUrl(null)}>
              <img src={zoomUrl} alt="" className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
            </div>
          )}
        </div>
      ) : adminTab === 'stats' ? (
        <div className="space-y-6">
          {/* Số dư Kie.ai */}
          <div className="p-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--color-accent-soft), transparent)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: 'var(--color-accent)', color: '#fff' }}>
                <Wallet size={20} />
              </div>
              <div>
                <p className="uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Số dư Kie.ai</p>
                <div className="font-bold" style={{ fontSize: 26, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                  {kieCreditsLoading ? '…' : kieCredits !== null ? `${kieCredits.toLocaleString()} credits` : 'Không lấy được'}
                </div>
              </div>
            </div>
            <button
              onClick={fetchKieCredits}
              disabled={kieCreditsLoading}
              className="rounded-full p-2 transition-colors"
              style={{ color: 'var(--color-text-secondary)', background: 'var(--color-fill)' }}
              title="Làm mới số dư"
            >
              <RotateCw size={16} className={kieCreditsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Top stats — handoff order: label top / value mid / sub bottom */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'Tổng ảnh đã gen',
                value: analytics.totalImages.toLocaleString(),
                sub: null,
                mono: false,
                color: 'var(--color-accent)',
              },
              {
                label: 'Chi phí ước tính',
                value: `$${analytics.totalCost.toFixed(2)}`,
                sub: { text: `${analytics.totalCredits.toLocaleString()} credits`, color: 'var(--color-text-tertiary)' },
                mono: true,
                color: 'var(--color-success)',
              },
              {
                label: 'Lượt truy cập tab',
                value: analytics.totalViews.toLocaleString(),
                sub: null,
                mono: false,
                color: 'var(--color-warning)',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="p-5 flex flex-col gap-2"
                style={{
                  background: 'var(--color-card)',
                  borderRadius: 16,
                  border: '0.5px solid var(--color-border-soft)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div className="uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>
                  {s.label}
                </div>
                <div
                  className="font-bold"
                  style={{
                    fontSize: 24,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text)',
                    fontFamily: s.mono ? 'var(--font-mono)' : undefined,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: s.sub?.color ?? 'var(--color-text-tertiary)', minHeight: 14 }}>
                  {s.sub?.text ?? ''}
                </div>
              </div>
            ))}
          </div>

          {/* Time filter — moved below the headline stats */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Segmented<'7d' | '15d' | '30d' | 'custom'>
              value={timeFilter}
              onChange={(v) => setTimeFilter(v)}
              size="sm"
              options={[
                { value: '7d', label: '7 ngày' },
                { value: '15d', label: '15 ngày' },
                { value: '30d', label: '30 ngày' },
                { value: 'custom', label: 'Tùy chọn' },
              ]}
            />
            {timeFilter === 'custom' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="outline-none"
                  style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 8, padding: '4px 8px', fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="outline-none"
                  style={{ background: 'var(--color-fill)', color: 'var(--color-text)', borderRadius: 8, padding: '4px 8px', fontSize: 12, border: '0.5px solid var(--color-border-soft)' }}
                />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {timeFilter === '7d' ? '7 ngày qua' : timeFilter === '15d' ? '15 ngày qua' : '30 ngày qua'}
              </span>
            )}
          </div>

          {usage.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
              Chưa có dữ liệu. Số liệu sẽ xuất hiện khi nhân viên bắt đầu gen ảnh.
            </p>
          )}

          {/* Biểu đồ cột theo ngày */}
          {analytics.dailySeries.length > 0 && (
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <p className="uppercase font-semibold mb-4" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Ảnh gen theo ngày</p>
              {(() => {
                // Chart caps at the latest 30 days — matches the widest preset filter.
                // Custom ranges longer than 30 days still cap here for readability.
                const data = analytics.dailySeries.slice(-30);
                const maxCount = Math.max(...data.map(d => d.count), 1);
                const barW = 28;
                const gap = 8;
                const chartH = 160;
                const labelEvery = Math.ceil(data.length / 12); // tránh nhãn chồng nhau
                return (
                  <div className="overflow-x-auto pb-1">
                    <div className="flex items-end gap-2" style={{ height: chartH + 36, minWidth: data.length * (barW + gap) }}>
                      {data.map((d, i) => {
                        const h = Math.max(2, Math.round((d.count / maxCount) * chartH));
                        const [, mm, dd] = d.day.split('-');
                        return (
                          <div key={d.day} className="flex flex-col items-center justify-end group" style={{ width: barW }}>
                            <span className="font-semibold mb-1" style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{d.count}</span>
                            <div
                              className="w-full rounded-t transition-all relative"
                              style={{ height: h, background: 'var(--color-accent)' }}
                              title={`${d.day}: ${d.count} ảnh · $${d.cost.toFixed(2)}`}
                            />
                            <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap', height: 24 }}>
                              {(i % labelEvery === 0 || i === data.length - 1) ? `${dd}/${mm}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                Di chuột vào cột để xem số ảnh + chi phí từng ngày.
              </p>
            </div>
          )}

          {/* By model + By feature */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo model · chất lượng</p>
              <div className="space-y-3">
                {Object.entries(analytics.byModelSize).sort((a, b) => {
                  const ca = Object.values(a[1]).reduce((s, x) => s + x.count, 0);
                  const cb = Object.values(b[1]).reduce((s, x) => s + x.count, 0);
                  return cb - ca;
                }).map(([m, sizes]) => {
                  const modelTotal = Object.values(sizes).reduce((acc, x) => ({ count: acc.count + x.count, cost: acc.cost + x.cost }), { count: 0, cost: 0 });
                  return (
                    <div key={m}>
                      <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 13 }}>
                        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{MODEL_LABELS[m] || m}</span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{modelTotal.count} ảnh · <span style={{ color: 'var(--color-success)' }}>${modelTotal.cost.toFixed(2)}</span></span>
                      </div>
                      <div className="space-y-1 pl-3" style={{ borderLeft: '2px solid var(--color-border-soft)' }}>
                        {Object.entries(sizes).sort((a, b) => a[0].localeCompare(b[0])).map(([size, v]) => (
                          <div key={size} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-tertiary)' }}>{size}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{v.count} ảnh · <span style={{ color: 'var(--color-success)' }}>${v.cost.toFixed(2)}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(analytics.byModelSize).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
              </div>
            </div>
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo tính năng</p>
              <div className="space-y-2">
                {Object.entries(analytics.byFeature).sort((a, b) => b[1] - a[1]).map(([f, c]) => (
                  <div key={f} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text)' }}>{FEATURE_LABELS[f] || f}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{c} ảnh</span>
                  </div>
                ))}
                {Object.keys(analytics.byFeature).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
              </div>
            </div>
          </div>

          {/* By user + tab views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Theo nhân viên</p>
              <div className="space-y-2">
                {Object.entries(analytics.byUser).sort((a, b) => b[1].count - a[1].count).map(([u, v]) => (
                  <div key={u} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                    <span className="truncate" style={{ color: 'var(--color-text)', maxWidth: 200 }}>{u}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{v.count} ảnh · <span style={{ color: 'var(--color-success)' }}>${v.cost.toFixed(2)}</span></span>
                  </div>
                ))}
                {Object.keys(analytics.byUser).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
              </div>
            </div>
            <div className="p-5" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
              <p className="uppercase font-semibold mb-3" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Lượt truy cập tab</p>
              <div className="space-y-2">
                {Object.entries(analytics.byView).sort((a, b) => b[1] - a[1]).map(([v, c]) => (
                  <div key={v} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text)' }}>{FEATURE_LABELS[v] || v}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{c} lượt</span>
                  </div>
                ))}
                {Object.keys(analytics.byView).length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>—</p>}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            * Tính theo số credit thật của Kie.ai (1 credit = $0.005). Tổng credit đã dùng khớp với mức trừ trên số dư.
          </p>
        </div>
      ) : (
        <>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="p-4 flex flex-col gap-2"
            style={{ background: 'var(--color-card)', borderRadius: 16, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}
            >
              <s.icon size={16} />
            </div>
            <div className="font-bold" style={{ fontSize: 24, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div className="uppercase font-semibold" style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create User Form */}
      <div className="p-6" style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)' }}>
        <h3 className="font-bold flex items-center gap-2 mb-4" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
          <UserPlus size={18} style={{ color: 'var(--color-accent)' }} /> Tạo tài khoản mới
        </h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block uppercase font-semibold mb-1.5" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                placeholder="Tối thiểu 6 ký tự"
                minLength={6}
                required
              />
            </div>
          </div>
          <Button type="submit" variant="filled" size="md" icon={UserPlus} disabled={creating}>
            {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
          </Button>
        </form>
      </div>

      {/* Users list — Apple Mail style rows */}
      <div style={{ background: 'var(--color-card)', borderRadius: 18, border: '0.5px solid var(--color-border-soft)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--color-border-soft)' }}>
          <h3 className="font-bold" style={{ fontSize: 17, letterSpacing: '-0.02em' }}>Danh sách người dùng</h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{users.length} tài khoản</span>
        </div>

        {loading ? (
          <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Đang tải…</div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center" style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Chưa có người dùng nào.</div>
        ) : (
          <div>
            {users.map((u, idx) => {
              const isAdmin = u.role === 'admin';
              const initial = (u.email || '?').slice(0, 1).toUpperCase();
              return (
                <div
                  key={u.uid}
                  className="px-6 py-4 flex items-center gap-4 flex-wrap transition-colors"
                  style={{ borderTop: idx === 0 ? 'none' : '0.5px solid var(--color-border-soft)' }}
                >
                  {/* Avatar */}
                  <div
                    className="flex items-center justify-center text-white font-bold shrink-0 rounded-full"
                    style={{
                      width: 40,
                      height: 40,
                      fontSize: 16,
                      background: isAdmin
                        ? 'linear-gradient(135deg, var(--color-indigo), var(--color-purple))'
                        : 'linear-gradient(135deg, var(--color-pink), var(--color-warning))',
                    }}
                  >
                    {initial}
                  </div>

                  {/* Email + password */}
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ fontSize: 14, color: 'var(--color-text)' }}>{u.email}</span>
                      {isAdmin
                        ? <Pill tone="accent">admin</Pill>
                        : <Pill tone="secondary">user</Pill>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {u.password ? (
                        <>
                          <span>{revealed[u.uid] ? u.password : '•'.repeat(Math.min(u.password.length, 10))}</span>
                          <button
                            onClick={() => setRevealed(prev => ({ ...prev, [u.uid]: !prev[u.uid] }))}
                            className="transition-colors"
                            style={{ color: 'var(--color-text-tertiary)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                            title={revealed[u.uid] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {revealed[u.uid] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </>
                      ) : (
                        <span style={{ opacity: 0.5 }}>— chưa lưu mật khẩu</span>
                      )}
                    </div>
                  </div>

                  {/* Permission switches */}
                  {!isAdmin && (
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Quần áo</span>
                        <Switch size="sm" checked={!!u.canUseClothing} onChange={() => togglePermission(u.uid, 'canUseClothing', !!u.canUseClothing)} ariaLabel="Quyền Quần áo" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Ecom</span>
                        <Switch size="sm" checked={!!u.canUseEcom} onChange={() => togglePermission(u.uid, 'canUseEcom', !!u.canUseEcom)} ariaLabel="Quyền Ecom" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>OFA</span>
                        <Switch size="sm" checked={!!u.canUseOfa} onChange={() => togglePermission(u.uid, 'canUseOfa', !!u.canUseOfa)} ariaLabel="Quyền OFA" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Picset</span>
                        <Switch size="sm" checked={!!u.canUsePicset} onChange={() => togglePermission(u.uid, 'canUsePicset', !!u.canUsePicset)} ariaLabel="Quyền Picset" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>RH</span>
                        <Switch size="sm" checked={!!u.canUseRunninghub} onChange={() => togglePermission(u.uid, 'canUseRunninghub', !!u.canUseRunninghub)} ariaLabel="Quyền Runninghub" />
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <Pill tone="accent">Toàn quyền</Pill>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
