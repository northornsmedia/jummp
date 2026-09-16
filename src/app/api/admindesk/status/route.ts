import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RoomServiceClient } from 'livekit-server-sdk';
import { getAdminSessionFromRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

interface ServiceCheck {
  name: string;
  category: 'database' | 'sfu' | 'auth' | 'config' | 'engine';
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number | null;
  message: string;
  details?: Record<string, any>;
}

interface LimitQuota {
  name: string;
  provider: 'Supabase' | 'LiveKit Cloud' | 'Application';
  used: number;
  limit: number;
  unit: string;
  percentage: number;
  tier: string;
  status: 'safe' | 'warning' | 'critical';
  notes: string;
}

export async function GET(req: NextRequest) {
  const isAuth = getAdminSessionFromRequest(req);
  if (!isAuth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Admin login required.', unauthenticated: true },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const checks: ServiceCheck[] = [];
  const limits: LimitQuota[] = [];

  // 1. Audit Environment Variables
  const envAudit = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_LIVEKIT_URL: !!process.env.NEXT_PUBLIC_LIVEKIT_URL,
    LIVEKIT_API_KEY: !!process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: !!process.env.LIVEKIT_API_SECRET,
    MEETING_TOKEN_SECRET: !!process.env.MEETING_TOKEN_SECRET,
  };

  const missingKeys = Object.entries(envAudit)
    .filter(([_, val]) => !val)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    checks.push({
      name: 'Environment Credentials',
      category: 'config',
      status: missingKeys.includes('NEXT_PUBLIC_SUPABASE_URL') ? 'down' : 'degraded',
      latencyMs: 0,
      message: `Missing ${missingKeys.length} config key(s): ${missingKeys.join(', ')}`,
      details: { envAudit },
    });
  } else {
    checks.push({
      name: 'Environment Credentials',
      category: 'config',
      status: 'healthy',
      latencyMs: 0,
      message: 'All core and security API credentials configured properly.',
      details: { envAudit },
    });
  }

  // 2. Supabase PostgreSQL Health & Metrics
  let supabaseStats = {
    totalMeetings: 0,
    activeMeetings: 0,
    staleActiveMeetings: 0,
    endedMeetings: 0,
    totalParticipants: 0,
    totalMessages: 0,
    totalBurnedMinutes: 0,
    totalParticipantStreamingMinutes: 0,
    recentMeetings: [] as any[],
  };

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const sbStart = performance.now();
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Probe meetings table
      const { data: meetings, count: meetingsCount, error: meetErr } = await supabase
        .from('meetings')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(500);

      const sbLatency = Math.round(performance.now() - sbStart);

      if (meetErr) {
        checks.push({
          name: 'Supabase PostgreSQL',
          category: 'database',
          status: 'down',
          latencyMs: sbLatency,
          message: `Database error: ${meetErr.message}`,
        });
      } else {
        // Query participants details & messages count
        const [{ data: participantsData, count: partCount }, { count: msgCount }] = await Promise.all([
          supabase.from('meeting_participants').select('id, meeting_id, name, joined_at, last_seen_at', { count: 'exact' }),
          supabase.from('meeting_messages').select('count', { count: 'exact', head: true }),
        ]);

        const allMeetings = meetings || [];
        const nowMs = Date.now();
        const tenMinsMs = 10 * 60 * 1000;

        let activeCount = 0;
        let staleCount = 0;
        let endedCount = 0;

        allMeetings.forEach((m) => {
          if (m.status === 'active') {
            const lastAct = new Date(m.last_activity_at || m.updated_at || m.created_at).getTime();
            if (nowMs - lastAct > tenMinsMs) {
              staleCount++;
            } else {
              activeCount++;
            }
          } else {
            endedCount++;
          }
        });

        // Group participants by meeting and compute actual streaming minutes
        const partMap = new Map<string, any[]>();
        let totalParticipantStreamingMinutes = 0;
        (participantsData || []).forEach((p) => {
          const list = partMap.get(p.meeting_id) || [];
          list.push(p);
          partMap.set(p.meeting_id, list);

          const joined = new Date(p.joined_at).getTime();
          const lastSeen = new Date(p.last_seen_at || p.joined_at).getTime();
          const diffMs = Math.max(0, lastSeen - joined);
          const pMins = Math.max(0.1, Math.round((diffMs / 60000) * 10) / 10);
          totalParticipantStreamingMinutes += pMins;
        });

        let totalBurnedMinutes = 0;
        const enrichedMeetings = allMeetings.map((m) => {
          const parts = partMap.get(m.id) || [];
          let burnedMinutes = 0;

          if (m.status === 'active') {
            const durMs = Math.max(0, nowMs - new Date(m.created_at).getTime());
            burnedMinutes = Math.max(1, Math.round((durMs / 60000) * 10) / 10);
          } else if (parts.length > 0) {
            // Real wall-clock span of the call from actual participant presence
            const joinTimes = parts.map((p) => new Date(p.joined_at).getTime());
            const leaveTimes = parts.map((p) => new Date(p.last_seen_at || p.joined_at).getTime());
            const start = Math.min(...joinTimes);
            const end = Math.max(...leaveTimes);
            const diffMs = Math.max(0, end - start);
            burnedMinutes = Math.max(0.5, Math.round((diffMs / 60000) * 10) / 10);
          } else {
            // Meeting was created but no guest/host entered
            const createdMs = new Date(m.created_at).getTime();
            const lastAct = new Date(m.last_activity_at || m.created_at).getTime();
            const diff = lastAct - createdMs;
            burnedMinutes = diff > 60000 ? Math.min(5, Math.round((diff / 60000) * 10) / 10) : 0;
          }

          totalBurnedMinutes += burnedMinutes;
          return {
            ...m,
            active_participants_count: parts.length,
            burnedMinutes,
          };
        });

        supabaseStats = {
          totalMeetings: meetingsCount || allMeetings.length,
          activeMeetings: activeCount,
          staleActiveMeetings: staleCount,
          endedMeetings: endedCount,
          totalParticipants: partCount || 0,
          totalMessages: msgCount || 0,
          totalBurnedMinutes: Math.round(totalBurnedMinutes * 10) / 10,
          totalParticipantStreamingMinutes: Math.round(totalParticipantStreamingMinutes * 10) / 10,
          recentMeetings: enrichedMeetings.slice(0, 500),
        };

        checks.push({
          name: 'Supabase PostgreSQL',
          category: 'database',
          status: sbLatency < 800 ? 'healthy' : 'degraded',
          latencyMs: sbLatency,
          message: `Connected (${sbLatency}ms). ${supabaseStats.totalMeetings} meetings, ${supabaseStats.totalParticipants} participants.`,
          details: {
            tables: ['meetings', 'meeting_participants', 'meeting_messages'],
            staleRoomsDetected: staleCount,
          },
        });
      }
    } catch (e: any) {
      checks.push({
        name: 'Supabase PostgreSQL',
        category: 'database',
        status: 'down',
        latencyMs: Date.now() - sbStart,
        message: `Connection failed: ${e.message || e}`,
      });
    }
  }

  // 3. LiveKit SFU Cloud Health & Active Rooms
  let livekitRooms: any[] = [];
  let totalLiveKitParticipants = 0;

  if (
    process.env.NEXT_PUBLIC_LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  ) {
    const lkStart = performance.now();
    try {
      const roomClient = new RoomServiceClient(
        process.env.NEXT_PUBLIC_LIVEKIT_URL,
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET
      );

      livekitRooms = await roomClient.listRooms();
      const lkLatency = Math.round(performance.now() - lkStart);

      totalLiveKitParticipants = livekitRooms.reduce((acc, r) => acc + (r.numParticipants || 0), 0);

      checks.push({
        name: 'LiveKit SFU Cloud',
        category: 'sfu',
        status: lkLatency < 1200 ? 'healthy' : 'degraded',
        latencyMs: lkLatency,
        message: `WebRTC SFU active (${lkLatency}ms). ${livekitRooms.length} room(s) online, ${totalLiveKitParticipants} live participant(s).`,
        details: {
          serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
          activeRoomsCount: livekitRooms.length,
          totalParticipants: totalLiveKitParticipants,
        },
      });
    } catch (e: any) {
      checks.push({
        name: 'LiveKit SFU Cloud',
        category: 'sfu',
        status: 'down',
        latencyMs: Math.round(performance.now() - lkStart),
        message: `LiveKit SFU unreachable: ${e.message || e}`,
      });
    }
  } else {
    checks.push({
      name: 'LiveKit SFU Cloud',
      category: 'sfu',
      status: 'degraded',
      latencyMs: null,
      message: 'LiveKit credentials incomplete. Video calls will fail over or error.',
    });
  }

  // 4. Inactivity Engine & Heartbeat Check
  const hasStaleRooms = supabaseStats.staleActiveMeetings > 0;
  checks.push({
    name: 'Meeting Inactivity Watchdog',
    category: 'engine',
    status: hasStaleRooms ? 'degraded' : 'healthy',
    latencyMs: null,
    message: hasStaleRooms
      ? `${supabaseStats.staleActiveMeetings} abandoned room(s) detected with no active heartbeat for >10m.`
      : 'Inactivity engine synced. No orphaned rooms detected.',
    details: {
      staleActiveMeetings: supabaseStats.staleActiveMeetings,
      thresholdMinutes: 10,
    },
  });

  // 5. Calculate Free Tier Usage & Quota Capacities
  // Supabase Free Tier Limits:
  // - Database storage: 500 MB (Rough estimate: ~1KB per row average for our lightweight schema)
  const estimatedDbBytes = (supabaseStats.totalMeetings * 1200) + (supabaseStats.totalParticipants * 800) + (supabaseStats.totalMessages * 500);
  const estimatedDbMB = Number((estimatedDbBytes / (1024 * 1024)).toFixed(2));
  const dbStorageLimitMB = 500;
  const dbStoragePct = Math.min(100, Number(((estimatedDbMB / dbStorageLimitMB) * 100).toFixed(1)));

  limits.push({
    name: 'Database Storage',
    provider: 'Supabase',
    used: estimatedDbMB,
    limit: dbStorageLimitMB,
    unit: 'MB',
    percentage: Math.max(0.5, dbStoragePct),
    tier: 'Hobby (Free)',
    status: dbStoragePct > 85 ? 'warning' : 'safe',
    notes: 'Supabase free quota is 500 MB. Lightweight records use negligible space.',
  });

  // Supabase Realtime Connections:
  // Free tier allows up to 200 peak concurrent connections
  const estRealtimeConnections = (supabaseStats.activeMeetings * 2) + totalLiveKitParticipants;
  const realtimeLimit = 200;
  const realtimePct = Math.min(100, Number(((estRealtimeConnections / realtimeLimit) * 100).toFixed(1)));

  limits.push({
    name: 'Realtime Peak Concurrents',
    provider: 'Supabase',
    used: estRealtimeConnections,
    limit: realtimeLimit,
    unit: 'connections',
    percentage: Math.max(1, realtimePct),
    tier: 'Hobby (Free)',
    status: realtimePct > 80 ? 'warning' : 'safe',
    notes: 'Max 200 concurrent WebSocket connections. Each participant holds 1 broadcast connection.',
  });

  // Supabase Monthly Active Users (MAU)
  const estimatedMau = Math.max(supabaseStats.totalParticipants, 1);
  const mauLimit = 50000;
  const mauPct = Math.min(100, Number(((estimatedMau / mauLimit) * 100).toFixed(2)));

  limits.push({
    name: 'Monthly Active Users (MAU)',
    provider: 'Supabase',
    used: estimatedMau,
    limit: mauLimit,
    unit: 'users',
    percentage: Math.max(0.1, mauPct),
    tier: 'Hobby (Free)',
    status: mauPct > 85 ? 'warning' : 'safe',
    notes: '50,000 monthly active users included in free tier. Anonymous participants counted.',
  });

  // LiveKit Cloud Free Tier:
  // 100 concurrent participants free
  const lkConcurrentLimit = 100;
  const lkConcurrentPct = Math.min(100, Number(((totalLiveKitParticipants / lkConcurrentLimit) * 100).toFixed(1)));

  limits.push({
    name: 'Concurrent WebRTC Participants',
    provider: 'LiveKit Cloud',
    used: totalLiveKitParticipants,
    limit: lkConcurrentLimit,
    unit: 'participants',
    percentage: Math.max(0, lkConcurrentPct),
    tier: 'Developer (Free)',
    status: lkConcurrentPct > 80 ? 'warning' : 'safe',
    notes: 'Free tier includes up to 100 concurrent participants streaming audio/video/screenshare.',
  });

  // LiveKit Cloud Monthly Egress / Minutes:
  // Free tier: 100,000 participant minutes / month or 1000 GB egress
  const actualStreamingMins = supabaseStats.totalParticipantStreamingMinutes || 0;
  const minutesLimit = 100000;
  const minutesPct = Math.min(100, Number(((actualStreamingMins / minutesLimit) * 100).toFixed(2)));

  limits.push({
    name: 'Participant Streaming Minutes',
    provider: 'LiveKit Cloud',
    used: actualStreamingMins,
    limit: minutesLimit,
    unit: 'mins/mo',
    percentage: Math.max(0.1, minutesPct),
    tier: 'Developer (Free)',
    status: minutesPct > 80 ? 'warning' : 'safe',
    notes: 'Measured from true participant session durations across all completed & active calls.',
  });

  // Overall system status
  const hasDown = checks.some((c) => c.status === 'down');
  const hasDegraded = checks.some((c) => c.status === 'degraded');
  const overallStatus: 'operational' | 'degraded' | 'outage' = hasDown
    ? 'outage'
    : hasDegraded
    ? 'degraded'
    : 'operational';

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
    overallStatus,
    checks,
    limits,
    metrics: {
      totalMeetings: supabaseStats.totalMeetings,
      activeMeetings: supabaseStats.activeMeetings,
      staleActiveMeetings: supabaseStats.staleActiveMeetings,
      endedMeetings: supabaseStats.endedMeetings,
      totalParticipants: supabaseStats.totalParticipants,
      totalMessages: supabaseStats.totalMessages,
      totalBurnedMinutes: supabaseStats.totalBurnedMinutes,
      totalParticipantStreamingMinutes: supabaseStats.totalParticipantStreamingMinutes,
      liveWebRtcRooms: livekitRooms.length,
      liveWebRtcParticipants: totalLiveKitParticipants,
    },
    livekitRooms: livekitRooms.map((r) => ({
      sid: r.sid,
      name: r.name,
      numParticipants: r.numParticipants,
      creationTime: r.creationTime ? new Date(Number(r.creationTime) * 1000).toISOString() : null,
    })),
    recentMeetings: supabaseStats.recentMeetings,
    server: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsageMB: Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1)),
      heapUsedMB: Number((process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(1)),
      heapTotalMB: Number((process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(1)),
      externalMB: Number((process.memoryUsage().external / (1024 * 1024)).toFixed(1)),
      uptimeSecs: Math.round(process.uptime()),
      env: process.env.NODE_ENV || 'development',
      measuredAt: new Date().toISOString(),
    },
  });
}

export async function POST(req: NextRequest) {
  const isAuth = getAdminSessionFromRequest(req);
  if (!isAuth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Admin login required.', unauthenticated: true },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { success: false, error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (action === 'sweep_stale') {
      // Find all rooms with status === 'active' where last_activity_at is older than 10 minutes
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const { data: staleRooms, error: selectErr } = await supabase
        .from('meetings')
        .select('id, code')
        .eq('status', 'active')
        .lt('last_activity_at', tenMinsAgo);

      if (selectErr) {
        return NextResponse.json({ success: false, error: selectErr.message }, { status: 400 });
      }

      if (!staleRooms || staleRooms.length === 0) {
        return NextResponse.json({
          success: true,
          action: 'sweep_stale',
          sweptCount: 0,
          message: 'No stale active rooms found. All sessions are healthy!',
        });
      }

      const staleIds = staleRooms.map((r) => r.id);
      const { error: updateErr } = await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: nowIso,
          updated_at: nowIso,
        })
        .in('id', staleIds);

      if (updateErr) {
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        action: 'sweep_stale',
        sweptCount: staleIds.length,
        sweptRooms: staleRooms.map((r) => r.code),
        message: `Successfully swept and concluded ${staleIds.length} abandoned room(s).`,
      });
    }

    if (action === 'force_end_room') {
      const { meetingId, code } = body;
      if (!meetingId && !code) {
        return NextResponse.json({ success: false, error: 'meetingId or code is required' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      let query = supabase.from('meetings').update({
        status: 'ended',
        ended_at: nowIso,
        updated_at: nowIso,
      });

      if (meetingId) {
        query = query.eq('id', meetingId);
      } else if (code) {
        query = query.eq('code', code);
      }

      const { error } = await query;
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        action: 'force_end_room',
        message: `Meeting room ${code || meetingId} has been forcibly concluded.`,
      });
    }

    if (action === 'extend_heartbeat') {
      const { code } = body;
      if (!code) {
        return NextResponse.json({ success: false, error: 'code is required' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('meetings')
        .update({
          status: 'active',
          last_activity_at: nowIso,
          updated_at: nowIso,
        })
        .eq('code', code);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        action: 'extend_heartbeat',
        message: `Activity extended for room ${code}. Inactivity timer reset by 10 minutes.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}
