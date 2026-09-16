import { NextRequest, NextResponse } from 'next/server';
import { signHostEvent, verifyHostEvent, verifyMeetingCapability } from '@/lib/meetingAuth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { room, hostToken, type, payload } = await req.json();
    if (![room, hostToken, type].every((value) => typeof value === 'string' && value)) {
      return NextResponse.json({ error: 'Missing event credentials' }, { status: 400 });
    }
    if (!verifyMeetingCapability(hostToken, room, 'host')) {
      return NextResponse.json({ error: 'Unauthorized host event' }, { status: 403 });
    }
    const issuedAt = Date.now();
    const signature = signHostEvent(room, type, payload, issuedAt);
    return NextResponse.json({ issuedAt, signature });
  } catch {
    return NextResponse.json({ error: 'Unable to sign event' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { room, type, payload, issuedAt, signature } = await req.json();
    const valid =
      typeof room === 'string' &&
      typeof type === 'string' &&
      typeof issuedAt === 'number' &&
      typeof signature === 'string' &&
      verifyHostEvent(room, type, payload, issuedAt, signature);
    return valid
      ? NextResponse.json({ valid: true })
      : NextResponse.json({ error: 'Invalid host event' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }
}
