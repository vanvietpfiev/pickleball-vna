import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  const user = await verifySession(token);
  return NextResponse.json({ user });
}
