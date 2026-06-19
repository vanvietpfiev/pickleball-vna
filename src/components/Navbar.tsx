'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

const links = [
  { href: '/',           label: 'Bảng XH',   icon: '🏆' },
  { href: '/matches',    label: 'Trận đấu',   icon: '⚡' },
  { href: '/session',    label: 'Chia đội',   icon: '👥' },
  { href: '/tournament', label: 'Giải đấu',   icon: '🥇' },
  { href: '/players',    label: 'Thành viên', icon: '👤' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoggedIn, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 gradient-navy shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-base">🏓</div>
            <div>
              <span className="font-black text-white text-base tracking-tight">Pickleball</span>
              <span className="font-light text-blue-200 text-base ml-1">VNA</span>
            </div>
          </Link>

          {/* Nav links — desktop only */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive(l.href) ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-100 hover:bg-white/15 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{l.icon}</span>
                <span className="hidden lg:block">{l.label}</span>
              </Link>
            ))}
          </div>

          {/* Auth */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Link href="/account"
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                      pathname.startsWith('/account') ? 'bg-white text-blue-800' : 'text-blue-100 hover:bg-white/15 hover:text-white'
                    }`}>
                    <span className="text-base">⚙️</span>
                    <span className="hidden lg:block">Quản lý</span>
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-blue-200 text-xs hidden sm:block">{user?.username}</span>
                  <button onClick={handleLogout}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold text-blue-100 hover:bg-white/15 hover:text-white transition-all">
                    <span className="text-base">🚪</span>
                    <span className="hidden md:block">Đăng xuất</span>
                  </button>
                </div>
              </>
            ) : (
              <Link href="/login"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                  pathname === '/login' ? 'bg-white text-blue-800' : 'bg-white/10 text-white hover:bg-white/20'
                }`}>
                <span className="text-base">🔐</span>
                <span className="hidden md:block">Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Bottom tab bar — mobile only ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link key={l.href} href={l.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 flex-1 transition-all ${
                  active ? 'text-blue-700' : 'text-slate-400'
                }`}
              >
                <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>{l.icon}</span>
                <span className={`text-[10px] font-semibold leading-tight ${active ? 'text-blue-700' : 'text-slate-400'}`}>{l.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-blue-600 mt-0.5" />}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
