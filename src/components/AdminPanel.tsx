import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase';
import { UserPlus, Shield, Eye, EyeOff, Users, Shirt, Grid3x3 } from 'lucide-react';
import { Button, Pill, Switch } from './ui';

export default function AdminPanel({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<any[]>([]);
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

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    clothing: users.filter(u => u.canUseClothing).length,
    ecom: users.filter(u => u.canUseEcom).length,
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                        <Switch checked={!!u.canUseClothing} onChange={() => togglePermission(u.uid, 'canUseClothing', !!u.canUseClothing)} ariaLabel="Quyền Quần áo" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="uppercase font-semibold" style={{ fontSize: 9, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em' }}>Ecom</span>
                        <Switch checked={!!u.canUseEcom} onChange={() => togglePermission(u.uid, 'canUseEcom', !!u.canUseEcom)} ariaLabel="Quyền Ecom" />
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
    </div>
  );
}
