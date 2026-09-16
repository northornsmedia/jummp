import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type MeetingCapabilityScope = 'host' | 'admitted';

export interface MeetingCapability {
  room: string;
  scope: MeetingCapabilityScope;
  participantId: string;
  name?: string;
  issuedAt: number;
  expiresAt: number;
}

const CAPABILITY_VERSION = 'v1';
const HOST_TTL_SECONDS = 60 * 60 * 24 * 30;
const GUEST_TTL_SECONDS = 60 * 60 * 12;

function getSigningSecret(): string {
  const secret = process.env.MEETING_TOKEN_SECRET || process.env.LIVEKIT_API_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error('MEETING_TOKEN_SECRET must be configured with at least 24 characters');
  }
  return secret;
}

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createMeetingId(): string {
  return `jmp-${randomBytes(9).toString('base64url').toLowerCase()}`;
}

export function createMeetingCapability(
  room: string,
  scope: MeetingCapabilityScope,
  participantId: string,
  name?: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: MeetingCapability = {
    room,
    scope,
    participantId,
    ...(name ? { name } : {}),
    issuedAt: now,
    expiresAt: now + (scope === 'host' ? HOST_TTL_SECONDS : GUEST_TTL_SECONDS),
  };
  const payload = encode(JSON.stringify(claims));
  return `${CAPABILITY_VERSION}.${payload}.${signPayload(payload)}`;
}

export function verifyMeetingCapability(
  token: string | null | undefined,
  expectedRoom: string,
  expectedScope?: MeetingCapabilityScope
): MeetingCapability | null {
  if (!token) return null;
  const [version, payload, signature, ...extra] = token.split('.');
  if (version !== CAPABILITY_VERSION || !payload || !signature || extra.length > 0) return null;
  if (!safeEqual(signature, signPayload(payload))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MeetingCapability;
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.room !== expectedRoom ||
      !claims.participantId ||
      !['host', 'admitted'].includes(claims.scope) ||
      claims.expiresAt <= now ||
      claims.issuedAt > now + 60 ||
      (expectedScope && claims.scope !== expectedScope)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function signHostEvent(room: string, type: string, payload: unknown, issuedAt: number): string {
  return createHmac('sha256', getSigningSecret())
    .update(JSON.stringify({ room, type, payload, issuedAt }))
    .digest('base64url');
}

export function verifyHostEvent(
  room: string,
  type: string,
  payload: unknown,
  issuedAt: number,
  signature: string
): boolean {
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 2 * 60 * 1000) return false;
  return safeEqual(signature, signHostEvent(room, type, payload, issuedAt));
}
