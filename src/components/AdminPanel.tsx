import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../firebase';
import { UserPlus, Shield, X, Check } from 'lucide-react';

export default function AdminPanel({ currentUser }: { currentUser: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New user form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);
    setError(null);

    try {
      // Initialize secondary app to create user without signing out current user
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      // Add user doc to firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        role: 'user',
        canUseClothing: true,
        canUseEcom: true,
        createdAt: new Date()
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

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Shield className="text-editor-accent" /> Quản trị viên
        </h2>
        <p className="text-gray-400">Quản lý người dùng và phân quyền sử dụng các tính năng.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Create User Form */}
      <div className="bg-editor-border/10 border border-editor-border rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <UserPlus size={18} /> Tạo tài khoản mới
        </h3>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">EMAIL</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-black border border-editor-border rounded-lg px-4 py-2 text-white outline-none focus:border-editor-accent"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">MẬT KHẨU</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black border border-editor-border rounded-lg px-4 py-2 text-white outline-none focus:border-editor-accent"
                placeholder="Min 6 chars"
                minLength={6}
                required
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={creating}
            className="px-6 py-2 bg-editor-accent text-black font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
          </button>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-editor-border/10 border border-editor-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-editor-border">
          <h3 className="text-lg font-bold text-white">Danh sách người dùng</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-editor-border/20 text-xs text-gray-500 uppercase tracking-wider">
                <th className="p-4 font-bold">Email</th>
                <th className="p-4 font-bold">Quyền</th>
                <th className="p-4 font-bold">Quyền Quần áo</th>
                <th className="p-4 font-bold">Quyền Ecom</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300 divide-y divide-editor-border/50">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Chưa có người dùng nào.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.uid} className="hover:bg-editor-border/10 transition-colors">
                    <td className="p-4 font-mono text-xs">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => togglePermission(u.uid, 'canUseClothing', !!u.canUseClothing)}
                          className={`w-12 h-6 rounded-full relative transition duration-200 ease-in-out ${u.canUseClothing ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                          <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition duration-200 ease-in-out ${u.canUseClothing ? 'left-[26px]' : 'left-1'}`} />
                        </button>
                      )}
                    </td>
                    <td className="p-4">
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => togglePermission(u.uid, 'canUseEcom', !!u.canUseEcom)}
                          className={`w-12 h-6 rounded-full relative transition duration-200 ease-in-out ${u.canUseEcom ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                          <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full transition duration-200 ease-in-out ${u.canUseEcom ? 'left-[26px]' : 'left-1'}`} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
