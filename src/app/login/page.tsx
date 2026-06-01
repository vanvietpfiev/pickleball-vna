'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const err = await login(username, password);
    if (err) { setError(err); setLoading(false); }
    else router.push('/');
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="gradient-navy rounded-3xl px-6 py-8 mb-6 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="relative">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">🏓</div>
            <h1 className="text-2xl font-black">Pickleball VNA</h1>
            <p className="text-blue-200 text-sm mt-1">Ban Kỹ Thuật · Vietnam Airlines</p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-700 mb-5">Đăng nhập</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Tên đăng nhập</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Mật khẩu</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 mt-1"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-4">
            Chỉ thành viên có tài khoản mới nhập được dữ liệu
          </p>
        </div>
      </div>
    </div>
  );
}
