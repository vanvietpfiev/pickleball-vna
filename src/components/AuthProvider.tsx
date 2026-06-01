'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SessionUser } from '@/lib/auth';

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, isLoggedIn: false, isAdmin: false,
  login: async () => null, logout: async () => {}, refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username: string, password: string): Promise<string | null> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) { setUser(data.user); return null; }
    return data.error ?? 'Đăng nhập thất bại';
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, isLoggedIn: !!user, isAdmin: user?.role === 'admin', login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() { return useContext(Ctx); }
