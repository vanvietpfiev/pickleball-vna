const SECRET = process.env.AUTH_SECRET ?? 'pickleball-vna-secret-change-me';

async function getKey() {
  const enc = new TextEncoder().encode(SECRET);
  return crypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export interface SessionUser {
  id: string;
  username: string;
  role: 'admin' | 'member';
}

export async function signSession(user: SessionUser): Promise<string> {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = Buffer.from(sig).toString('base64url');
  return `${payload}.${sigB64}`;
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const [payload, sigB64] = token.split('.');
    if (!payload || !sigB64) return null;
    const key = await getKey();
    const sig = Buffer.from(sigB64, 'base64url');
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
    if (!valid) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionUser;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'pb_session';
