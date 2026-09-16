import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMeetingCapability } from '@/lib/meetingAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Meeting persistence is not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { code, participantName, action, credential } = body;
    if (typeof code !== 'string' || typeof credential !== 'string') {
      return NextResponse.json({ error: 'Missing meeting credentials' }, { status: 400 });
    }

    const capability = verifyMeetingCapability(credential, code);
    if (!capability) {
      return NextResponse.json({ error: 'Invalid or expired meeting admission' }, { status: 401 });
    }
    if (
      capability.scope === 'admitted' &&
      capability.name &&
      capability.name !== participantName
    ) {
      return NextResponse.json({ error: 'Participant identity mismatch' }, { status: 403 });
    }

    const safeAction = action === 'leave' || action === 'keepalive' ? action : 'heartbeat';
    const { data, error } = await supabase.rpc('rpc_heartbeat', {
      p_code: code,
      p_participant_name: participantName || (capability.scope === 'host' ? 'Host' : 'Guest'),
      p_is_host: capability.scope === 'host',
      p_action: safeAction,
    });

    if (error) {
      console.error('rpc_heartbeat failed:', error.message);
      return NextResponse.json({ error: 'Meeting heartbeat is unavailable' }, { status: 503 });
    }
    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 409 });
    }
    return NextResponse.json(data || { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.warn('Meeting heartbeat backend error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Meeting persistence is not configured' }, { status: 503 });
    }
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('code,status,active_participants_count,last_activity_at,updated_at,created_at')
      .eq('code', code)
      .maybeSingle();

    if (error || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const lastActivity = new Date(
      meeting.last_activity_at || meeting.updated_at || meeting.created_at
    ).getTime();
    const inactiveMs = Math.max(0, Date.now() - lastActivity);
    const isInactiveEnded =
      meeting.status === 'ended' ||
      ((!meeting.active_participants_count || meeting.active_participants_count <= 0) &&
        inactiveMs >= 10 * 60 * 1000);

    return NextResponse.json({
      code: meeting.code,
      status: meeting.status,
      activeParticipantsCount: meeting.active_participants_count || 0,
      isInactiveEnded,
      inactiveMinutes: Math.floor(inactiveMs / 60_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
