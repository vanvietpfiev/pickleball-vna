import { NextRequest, NextResponse } from 'next/server';
import { gasGet } from '@/lib/appsScript';
import { balancedPairs, randomPairs } from '@/lib/elo';
import { Player } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { playerIds, mode } = await req.json();
    if (!playerIds?.length) return NextResponse.json({ error: 'No players' }, { status: 400 });

    const players = await gasGet<Player[]>('getPlayers');
    const eloMap: Record<string, number> = {};
    players.forEach((p) => (eloMap[p.id] = p.elo));

    const teams = mode === 'random' ? randomPairs(playerIds) : balancedPairs(playerIds, eloMap);
    return NextResponse.json({ teams, mode });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
