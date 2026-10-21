import { NextRequest, NextResponse } from 'next/server';
import { verifyMeetingCapability } from '@/lib/meetingAuth';
import {
  updateParticipantPublishPermissions,
  setRoomWebinarModeSFU,
  muteAllAttendeesSFU,
  stopAllAttendeesVideoSFU,
} from '@/lib/livekitServer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      room,
      hostToken,
      action,
      targetParticipantId,
      targetName,
      kind,
      webinarMode,
      activeHosts,
    } = body;

    if (!room || !hostToken || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters (room, hostToken, action)' },
        { status: 400 }
      );
    }

    // Verify caller is an authorized host
    const hostClaim = verifyMeetingCapability(hostToken, room, 'host');
    if (!hostClaim) {
      return NextResponse.json(
        { error: 'Unauthorized: Only an active host can update LiveKit permissions' },
        { status: 403 }
      );
    }

    const hostIdentities = Array.isArray(activeHosts)
      ? [hostClaim.participantId, hostClaim.name, ...activeHosts].filter(Boolean)
      : [hostClaim.participantId, hostClaim.name].filter(Boolean);

    switch (action) {
      case 'APPROVE_MEDIA': {
        const target = targetParticipantId || targetName;
        if (!target) {
          return NextResponse.json({ error: 'Missing target participant' }, { status: 400 });
        }
        const ok = await updateParticipantPublishPermissions(room, target, {
          canPublishMic: kind === 'mic' || kind === 'both',
          canPublishCamera: kind === 'camera' || kind === 'both',
        });
        return NextResponse.json({ success: ok, target, kind, action });
      }

      case 'REVOKE_MEDIA': {
        const target = targetParticipantId || targetName;
        if (!target) {
          return NextResponse.json({ error: 'Missing target participant' }, { status: 400 });
        }
        const ok = await updateParticipantPublishPermissions(room, target, {
          canPublishMic: kind === 'mic' ? false : undefined,
          canPublishCamera: kind === 'camera' ? false : undefined,
          revokeAll: kind === 'all',
        });
        return NextResponse.json({ success: ok, target, kind, action });
      }

      case 'SET_WEBINAR_MODE': {
        const isWebinar = Boolean(webinarMode);
        const ok = await setRoomWebinarModeSFU(room, isWebinar, hostIdentities as string[]);
        return NextResponse.json({ success: ok, webinarMode: isWebinar, action });
      }

      case 'PROMOTE_HOST': {
        const target = targetParticipantId || targetName;
        if (!target) {
          return NextResponse.json({ error: 'Missing target participant' }, { status: 400 });
        }
        const ok = await updateParticipantPublishPermissions(room, target, {
          canPublishAll: true,
        });
        return NextResponse.json({ success: ok, target, action });
      }

      case 'MUTE_ALL_AUDIO': {
        const ok = await muteAllAttendeesSFU(room, hostIdentities as string[]);
        return NextResponse.json({ success: ok, action });
      }

      case 'STOP_ALL_VIDEO': {
        const ok = await stopAllAttendeesVideoSFU(room, hostIdentities as string[]);
        return NextResponse.json({ success: ok, action });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('LiveKit permission API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update LiveKit permission' },
      { status: 500 }
    );
  }
}
