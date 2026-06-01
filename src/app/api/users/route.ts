import { NextRequest, NextResponse } from 'next/server';
import { gasGet, gasPost } from '@/lib/appsScript';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  return user?.role === 'admin' ? user : null;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const users = await gasGet('getUsers');
    return NextResponse.json(users);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const user = await gasPost({ action: 'addUser', ...body });
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const result = await gasPost({ action: 'updateUser', ...body });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await req.json();
    const result = await gasPost({ action: 'deleteUser', id });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
