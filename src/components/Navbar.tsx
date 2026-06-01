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

  return (
    <nav className="sticky top-0 z-40 gradient-navy shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-base">🏓</div>
          <div className="hidden sm:block">
            <span className="font-black text-white text-base tracking-tight">Pickleball</span>
            <span className="font-light text-blue-200 text-base ml-1">VNA</span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-100 hover:bg-white/15 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{l.icon}</span>
                <span className="hidden md:block">{l.label}</span>
              </Link>
            );
          })}
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
  );
}
