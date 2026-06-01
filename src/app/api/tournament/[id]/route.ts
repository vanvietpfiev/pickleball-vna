import { NextRequest, NextResponse } from 'next/server';
import { gasGet, gasPost } from '@/lib/appsScript';
import { Tournament } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const all = await gasGet<Tournament[]>('getTournaments');
    const t = all.find((x) => x.id === id);
    if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(t);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await gasPost({ action: 'updateTournament', id, ...body });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await gasPost({ action: 'deleteTournament', id });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
