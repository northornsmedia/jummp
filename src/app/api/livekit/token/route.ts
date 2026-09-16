import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { verifyMeetingCapability } from '@/lib/meetingAuth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const room = typeof body.room === 'string' ? body.room : '';
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 80) : '';
  const credential = typeof body.credential === 'string' ? body.credential : '';

  if (!room || !username || !credential) {
    return NextResponse.json({ error: 'Missing room, username, or admission credential' }, { status: 400 });
  }

  const capability = verifyMeetingCapability(credential, room);
  if (!capability || (capability.scope === 'admitted' && capability.name !== username)) {
    return NextResponse.json({ error: 'You have not been admitted to this meeting' }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  // If LiveKit credentials aren't provided yet, gracefully return mode 'p2p'
  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({
      configured: false,
      mode: 'p2p',
      message: 'LiveKit credentials not configured. Falling back to native WebRTC P2P.',
    });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: capability.participantId,
      name: username,
      ttl: '2h',
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      configured: true,
      mode: 'livekit',
      token,
      url: livekitUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to create media token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
