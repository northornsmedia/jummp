import { NextRequest, NextResponse } from 'next/server';
import {
  createMeetingCapability,
  createMeetingId,
  verifyMeetingCapability,
} from '@/lib/meetingAuth';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const room = createMeetingId();
    const participantId = crypto.randomUUID();
    const hostToken = createMeetingCapability(room, 'host', participantId);
    return NextResponse.json({ room, hostToken });
  } catch (error) {
    console.error('Meeting creation failed:', error);
    return NextResponse.json({ error: 'Meeting service is not configured' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { room, hostToken } = await req.json();
    if (typeof room !== 'string' || typeof hostToken !== 'string') {
      return NextResponse.json({ error: 'Missing meeting credentials' }, { status: 400 });
    }
    const capability = verifyMeetingCapability(hostToken, room, 'host');
    return capability
      ? NextResponse.json({ valid: true, participantId: capability.participantId })
      : NextResponse.json({ error: 'Invalid host capability' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { room, hostToken, participantId, name } = await req.json();
    if (![room, hostToken, participantId, name].every((value) => typeof value === 'string' && value)) {
      return NextResponse.json({ error: 'Missing admission details' }, { status: 400 });
    }
    if (!verifyMeetingCapability(hostToken, room, 'host')) {
      return NextResponse.json({ error: 'Only the host can admit participants' }, { status: 403 });
    }
    const admissionToken = createMeetingCapability(room, 'admitted', participantId, name);
    return NextResponse.json({ admissionToken });
  } catch (error) {
    console.error('Guest admission failed:', error);
    return NextResponse.json({ error: 'Unable to admit participant' }, { status: 500 });
  }
}
