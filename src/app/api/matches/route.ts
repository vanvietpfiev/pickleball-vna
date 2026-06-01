import { NextRequest, NextResponse } from 'next/server';
import { gasGet, gasPost } from '@/lib/appsScript';
import { Match } from '@/lib/types';

export async function GET() {
  try {
    const matches = await gasGet<Match[]>('getMatches');
    return NextResponse.json(matches);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, team1, team2, score1, score2, winningSide, notes } = body;

    if (!type || !team1?.length || !team2?.length || score1 == null || score2 == null || !winningSide) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const match = await gasPost<Match>({
      action: 'addMatch', type, team1, team2,
      score1: Number(score1), score2: Number(score2), winningSide, notes,
    });
    return NextResponse.json(match);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
