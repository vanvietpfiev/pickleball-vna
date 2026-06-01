import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return NextResponse.json({ error: 'APPS_SCRIPT_URL not set' }, { status: 500 });

  try {
    const res = await fetch(`${url}?action=getPlayers`, {
      redirect: 'follow',
      headers: { 'Accept': 'application/json' },
    });

    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not json */ }

    return NextResponse.json({
      status: res.status,
      url: res.url,
      isJson: parsed !== null,
      preview: text.slice(0, 500),
      parsed,
    });
  } catch (e) {
    return NextResponse.json({ fetchError: String(e) }, { status: 500 });
  }
}
