'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface UserRow {
  id: string;
  username: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export default function AccountPage() {
  const { isAdmin, loading: authLoading, user: me } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Change password
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
      else setError(data.error ?? 'Lỗi tải dữ liệu');
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const addUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setSubmitting(true); setFormError('');
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewUsername(''); setNewPassword(''); setNewRole('member');
      setUsers((prev) => [...prev, data]);
    } else setFormError(data.error ?? 'Lỗi');
    setSubmitting(false);
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Xoá tài khoản này?')) return;
    await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const changePassword = async (id: string) => {
    if (!newPwd.trim()) return;
    await fetch('/api/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: newPwd }),
    });
    setEditingId(null); setNewPwd('');
  };

  if (authLoading || !isAdmin) return null;

  return (
    <div className="animate-fade-in">
      <div className="gradient-navy rounded-3xl px-6 pt-7 pb-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative">
          <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-1">Quản trị viên</p>
          <h1 className="text-3xl font-black">Quản lý tài khoản</h1>
          <p className="text-blue-200 text-sm mt-1">{users.length} tài khoản</p>
        </div>
      </div>

      {/* Add user form */}
      <div className="card p-5 mb-8">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Thêm tài khoản mới</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-36">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Tên đăng nhập *</label>
            <input className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
          </div>
          <div className="flex-1 min-w-36">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Mật khẩu *</label>
            <input type="password" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="w-32">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Vai trò</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              value={newRole} onChange={(e) => setNewRole(e.target.value as 'admin' | 'member')}>
              <option value="member">Thành viên</option>
              <option value="admin">Quản trị</option>
            </select>
          </div>
          <button onClick={addUser} disabled={submitting || !newUsername.trim() || !newPassword.trim()}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0">
            {submitting ? '...' : '+ Thêm'}
          </button>
        </div>
        {formError && <p className="text-red-500 text-sm mt-3">⚠️ {formError}</p>}
      </div>

      {/* User list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Danh sách tài khoản</p>
        </div>
        {error && <p className="text-red-500 text-sm px-5 py-3">⚠️ {error}</p>}
        <div className="divide-y divide-slate-50">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
                <div className="w-9 h-9 bg-slate-100 rounded-full" />
                <div className="flex-1 h-4 bg-slate-100 rounded-full" />
              </div>
            ))
          ) : users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-sm flex-shrink-0">
                {u.username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm">{u.username}</p>
                  {u.id === me?.id && <span className="text-xs text-blue-500 font-medium">(bạn)</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.role === 'admin' ? 'Quản trị' : 'Thành viên'}
                  </span>
                </div>
                {editingId === u.id ? (
                  <div className="flex gap-2 mt-1.5">
                    <input type="password" className="border border-slate-200 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Mật khẩu mới" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoFocus />
                    <button onClick={() => changePassword(u.id)}
                      className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">Lưu</button>
                    <button onClick={() => { setEditingId(null); setNewPwd(''); }}
                      className="text-slate-400 px-2 py-1 rounded-lg text-xs hover:bg-slate-100 transition-all">Huỷ</button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tạo: {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setEditingId(u.id); setNewPwd(''); }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-all">
                  Đổi MK
                </button>
                {u.id !== me?.id && (
                  <button onClick={() => deleteUser(u.id)}
                    className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-all">
                    Xoá
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
