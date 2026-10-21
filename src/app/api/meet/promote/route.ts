import { NextRequest, NextResponse } from 'next/server';
import { createMeetingCapability, verifyMeetingCapability } from '@/lib/meetingAuth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { room, hostToken, targetParticipantId, targetName } = await req.json();

    if (!room || !hostToken || !targetParticipantId || !targetName) {
      return NextResponse.json(
        { error: 'Missing required fields (room, hostToken, targetParticipantId, targetName)' },
        { status: 400 }
      );
    }

    // Verify that the caller is indeed an authorized host of this room
    const hostClaim = verifyMeetingCapability(hostToken, room, 'host');
    if (!hostClaim) {
      return NextResponse.json(
        { error: 'Unauthorized: Only an active host can promote other participants' },
        { status: 403 }
      );
    }

    // Generate a valid host token for the target participant
    const newHostToken = createMeetingCapability(room, 'host', targetParticipantId, targetName);

    return NextResponse.json({
      success: true,
      room,
      targetParticipantId,
      targetName,
      hostToken: newHostToken,
    });
  } catch (error) {
    console.error('Failed to promote participant to host:', error);
    return NextResponse.json({ error: 'Internal server error while promoting participant' }, { status: 500 });
  }
}
