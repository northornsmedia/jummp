import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const apiKey = process.env.LIVEKIT_API_KEY || '';
const apiSecret = process.env.LIVEKIT_API_SECRET || '';

const receiver = new WebhookReceiver(apiKey, apiSecret);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || undefined;

  if (!authHeader) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let event: any;
  try {
    const rawBody = await req.text();
    event = await receiver.receive(rawBody, authHeader);
  } catch (verifyErr: any) {
    console.error('[LiveKit Webhook] Signature verification failed:', verifyErr?.message);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
  }

  const eventType = event.event;
  const roomName = event.room?.name;
  console.log(`[LiveKit Webhook] Received ${eventType} for room: ${roomName || 'unknown'}`);

  const supabase = getSupabase();
  if (!supabase || !roomName) {
    return NextResponse.json({ received: true, skipped: !supabase ? 'no_db' : 'no_room' });
  }

  try {
    const eventTimeSec = Number(event.createdAt || Date.now() / 1000);
    const eventTimeIso = new Date(eventTimeSec * 1000).toISOString();

    // 1. Resolve meeting by room code
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, code, status, created_at')
      .eq('code', roomName)
      .maybeSingle();

    if (eventType === 'room_started') {
      if (meeting) {
        await supabase
          .from('meetings')
          .update({
            status: 'active',
            last_activity_at: eventTimeIso,
            updated_at: eventTimeIso,
          })
          .eq('id', meeting.id);
      }
    } else if (eventType === 'participant_joined') {
      const pIdentity = event.participant?.identity || event.participant?.name || 'Guest';
      const joinSec = Number(event.participant?.joinedAt || eventTimeSec);
      const joinIso = new Date(joinSec * 1000).toISOString();

      if (meeting) {
        // Update meeting activity & active participant count
        const activeCount = Math.max(1, event.room?.numParticipants || 1);
        await supabase
          .from('meetings')
          .update({
            status: 'active',
            last_activity_at: joinIso,
            active_participants_count: activeCount,
            updated_at: joinIso,
          })
          .eq('id', meeting.id);

        // Record participant entry
        const { data: existing } = await supabase
          .from('meeting_participants')
          .select('id')
          .eq('meeting_id', meeting.id)
          .eq('name', pIdentity)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('meeting_participants')
            .update({
              status: 'admitted',
              last_seen_at: joinIso,
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('meeting_participants').insert({
            meeting_id: meeting.id,
            name: pIdentity,
            role: 'guest',
            status: 'admitted',
            joined_at: joinIso,
            last_seen_at: joinIso,
          });
        }
      }
    } else if (eventType === 'participant_left') {
      const pIdentity = event.participant?.identity || event.participant?.name;
      if (meeting && pIdentity) {
        const remainingCount = Math.max(0, (event.room?.numParticipants || 1) - 1);
        await supabase
          .from('meetings')
          .update({
            last_activity_at: eventTimeIso,
            active_participants_count: remainingCount,
            updated_at: eventTimeIso,
          })
          .eq('id', meeting.id);

        await supabase
          .from('meeting_participants')
          .update({
            status: 'left',
            last_seen_at: eventTimeIso,
          })
          .eq('meeting_id', meeting.id)
          .eq('name', pIdentity);
      }
    } else if (eventType === 'room_finished') {
      if (meeting) {
        await supabase
          .from('meetings')
          .update({
            status: 'ended',
            ended_at: eventTimeIso,
            last_activity_at: eventTimeIso,
            active_participants_count: 0,
            updated_at: eventTimeIso,
          })
          .eq('id', meeting.id);

        // Mark any remaining active participants as left
        await supabase
          .from('meeting_participants')
          .update({
            status: 'left',
            last_seen_at: eventTimeIso,
          })
          .eq('meeting_id', meeting.id)
          .neq('status', 'left');
      }
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (err: any) {
    console.error('[LiveKit Webhook] Error processing event:', err?.message);
    // Return 200 to prevent LiveKit webhook retry loops on application-level processing errors
    return NextResponse.json({ received: true, error: err?.message });
  }
}
