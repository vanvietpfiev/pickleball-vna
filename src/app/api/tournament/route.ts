import { NextRequest, NextResponse } from 'next/server';
import { gasGet, gasPost } from '@/lib/appsScript';
import { Tournament } from '@/lib/types';

export async function GET() {
  try {
    const tournaments = await gasGet<Tournament[]>('getTournaments');
    return NextResponse.json(tournaments);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tournament = await gasPost<Tournament>({ action: 'addTournament', ...body });
    return NextResponse.json(tournament);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
