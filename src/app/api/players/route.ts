import { NextRequest, NextResponse } from 'next/server';
import { gasGet, gasPost } from '@/lib/appsScript';
import { Player } from '@/lib/types';

export async function GET() {
  try {
    const players = await gasGet<Player[]>('getPlayers');
    return NextResponse.json(players);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, avatar, initialElo, level } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const player = await gasPost<Player>({ action: 'addPlayer', name: name.trim(), avatar, initialElo, level });
    return NextResponse.json(player);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (body.avatar !== undefined) {
      const result = await gasPost({ action: 'updateAvatar', id, avatar: body.avatar });
      return NextResponse.json(result);
    }
    if (body.level !== undefined || body.initialElo !== undefined) {
      const result = await gasPost({ action: 'updatePlayerLevel', id, level: body.level, initialElo: body.initialElo });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
