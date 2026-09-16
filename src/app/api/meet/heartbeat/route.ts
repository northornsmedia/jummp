import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyqcrrjxrmlnonsppnlp.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5cWNycmp4cm1sbm9uc3BwbmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODUzNTcsImV4cCI6MjEwNTA2MTM1N30.8EE-6YLpE5PBq-aZ6XDdee0XApxizHkLVYMU5paiv4Q';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, participantName, isHost, action } = body;

    if (!code) {
      return NextResponse.json({ error: 'Missing meeting code' }, { status: 400 });
    }

    // 1. Try atomic PostgreSQL RPC engine
    const { data: rpcResult, error: rpcError } = await supabase.rpc('rpc_heartbeat', {
      p_code: code,
      p_participant_name: participantName || null,
      p_is_host: !!isHost,
      p_action: action || 'heartbeat',
    });

    if (!rpcError && rpcResult && !rpcResult.error) {
      return NextResponse.json(rpcResult);
    }

    // 2. Fallback to direct client-side queries if RPC is unavailable
    const { data: meeting, error: mError } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (mError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (action === 'leave') {
      if (participantName) {
        await supabase
          .from('meeting_participants')
          .update({ status: 'left', last_seen_at: nowIso })
          .eq('meeting_id', meeting.id)
          .eq('name', participantName);
      }
    } else {
      if (participantName) {
        const { data: existingPart } = await supabase
          .from('meeting_participants')
          .select('id')
          .eq('meeting_id', meeting.id)
          .eq('name', participantName)
          .maybeSingle();

        if (existingPart) {
          await supabase
            .from('meeting_participants')
            .update({ status: 'admitted', last_seen_at: nowIso })
            .eq('id', existingPart.id);
        } else {
          await supabase.from('meeting_participants').insert({
            meeting_id: meeting.id,
            name: participantName,
            role: isHost ? 'host' : 'guest',
            status: 'admitted',
            last_seen_at: nowIso,
          });
        }
      }
    }

    // Count participants seen in last 45s
    const threshold45s = new Date(now.getTime() - 45 * 1000).toISOString();
    const { count: activeCount } = await supabase
      .from('meeting_participants')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', meeting.id)
      .eq('status', 'admitted')
      .gte('last_seen_at', threshold45s);

    const safeActiveCount = activeCount || 0;

    // 10-minute inactivity threshold rule
    const lastActivity = new Date(meeting.last_activity_at || meeting.updated_at || meeting.created_at).getTime();
    const inactiveMs = now.getTime() - lastActivity;
    const tenMinutesMs = 10 * 60 * 1000;
    const isOverTenMinutesInactive = safeActiveCount === 0 && inactiveMs >= tenMinutesMs;

    let updatedStatus = meeting.status;

    if (isOverTenMinutesInactive) {
      updatedStatus = 'ended';
      await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: nowIso,
          active_participants_count: 0,
          updated_at: nowIso,
        })
        .eq('id', meeting.id);
    } else if (safeActiveCount > 0) {
      updatedStatus = 'active';
      await supabase
        .from('meetings')
        .update({
          status: 'active',
          last_activity_at: nowIso,
          active_participants_count: safeActiveCount,
          updated_at: nowIso,
        })
        .eq('id', meeting.id);
    } else {
      await supabase
        .from('meetings')
        .update({
          active_participants_count: 0,
          updated_at: nowIso,
        })
        .eq('id', meeting.id);
    }

    // Trigger sweep
    try {
      await supabase.rpc('mark_inactive_meetings_ended');
    } catch {}

    return NextResponse.json({
      success: true,
      status: updatedStatus,
      activeParticipantsCount: safeActiveCount,
      isInactiveEnded: isOverTenMinutesInactive,
      inactiveMinutes: Math.floor(inactiveMs / (1000 * 60)),
      serverTime: nowIso,
    });
  } catch (err: any) {
    console.warn('Meeting heartbeat backend error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    // Trigger platform-wide sweep first
    try {
      await supabase.rpc('mark_inactive_meetings_ended');
    } catch {}

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const now = new Date();
    const lastActivity = new Date(meeting.last_activity_at || meeting.updated_at || meeting.created_at).getTime();
    const inactiveMs = now.getTime() - lastActivity;
    const tenMinutesMs = 10 * 60 * 1000;
    const isOverTenMinutesInactive =
      (meeting.active_participants_count <= 0 || !meeting.active_participants_count) &&
      inactiveMs >= tenMinutesMs;

    if (isOverTenMinutesInactive && meeting.status !== 'ended') {
      await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: now.toISOString(),
          active_participants_count: 0,
          updated_at: now.toISOString(),
        })
        .eq('id', meeting.id);
      meeting.status = 'ended';
    }

    return NextResponse.json({
      code: meeting.code,
      status: meeting.status,
      activeParticipantsCount: meeting.active_participants_count || 0,
      isInactiveEnded: isOverTenMinutesInactive || meeting.status === 'ended',
      inactiveMinutes: Math.floor(inactiveMs / (1000 * 60)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
