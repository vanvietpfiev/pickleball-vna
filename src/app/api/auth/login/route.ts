import { NextRequest, NextResponse } from 'next/server';
import { gasPost } from '@/lib/appsScript';
import { signSession, SESSION_COOKIE, SessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    const user = await gasPost<SessionUser | null>({ action: 'validateCredentials', username, password });
    if (!user) return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });

    const token = await signSession(user);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
