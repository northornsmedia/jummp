import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'jummp_admin_session';

function getAdminSecret(): string {
  return process.env.MEETING_TOKEN_SECRET || process.env.LIVEKIT_API_SECRET || 'jummp-admin-secret-2026-min24chars';
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function validateAdminCredentials(username: string, pass: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'jummp@admin2026';
  return safeCompare(username, expectedUser) && safeCompare(pass, expectedPass);
}

export function createAdminSessionToken(username: string): string {
  const now = Date.now();
  const exp = now + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = Buffer.from(JSON.stringify({ user: username, exp, iat: now })).toString('base64url');
  const signature = createHmac('sha256', getAdminSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expectedSig = createHmac('sha256', getAdminSecret()).update(payload).digest('base64url');
  if (!safeCompare(signature, expectedSig)) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.exp || Date.now() > claims.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function getAdminSessionFromRequest(req: NextRequest): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie && verifyAdminSessionToken(cookie)) return true;

  // Also allow Bearer token in Authorization header for programmatic API queries
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (verifyAdminSessionToken(bearer)) return true;
  }

  return false;
}

export { SESSION_COOKIE_NAME };
