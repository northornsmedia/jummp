import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (typeof window !== 'undefined') {
    console.warn(
      '[Supabase] NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. Supabase operations may be degraded.'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

export interface DBMeeting {
  id: string;
  code: string;
  title: string;
  host_name: string;
  host_id?: string | null;
  status: 'scheduled' | 'active' | 'ended' | 'expired';
  scheduled_at?: string | null;
  created_at: string;
  updated_at?: string;
  last_activity_at?: string | null;
  ended_at?: string | null;
  is_locked?: boolean;
  active_participants_count?: number;
}

export interface DBParticipant {
  id: string;
  meeting_id: string;
  name: string;
  role: 'host' | 'guest' | 'co-host';
  status: 'pending' | 'admitted' | 'denied' | 'left';
  joined_at: string;
  last_seen_at?: string;
}

export interface DBMessage {
  id: string;
  meeting_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface MeetingStatusCheck {
  exists: boolean;
  meeting: DBMeeting | null;
  isExpired: boolean;
  isActive: boolean;
  isEnded: boolean;
  daysInactive: number;
  message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidFormat(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

// In-memory cache to quickly map meeting codes to UUIDs
const codeToUuidCache = new Map<string, string>();

/**
 * Resolves a meeting code or UUID to its primary key UUID in the Supabase 'meetings' table.
 */
export async function resolveMeetingUuid(codeOrId: string): Promise<string | null> {
  if (!codeOrId || typeof codeOrId !== 'string') return null;
  const trimmed = codeOrId.trim();
  if (isUuidFormat(trimmed)) return trimmed;

  if (codeToUuidCache.has(trimmed)) {
    return codeToUuidCache.get(trimmed)!;
  }

  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, code')
      .eq('code', trimmed)
      .maybeSingle();

    if (!error && data?.id) {
      codeToUuidCache.set(trimmed, data.id);
      return data.id;
    }
  } catch (err) {
    console.warn('Error resolving meeting UUID:', err);
  }

  return null;
}

// Check meeting lifecycle status (e.g. anonymous user clicking link after days or weeks)
export async function checkMeetingStatus(codeOrId: string): Promise<MeetingStatusCheck> {
  try {
    const query = supabase.from('meetings').select('*');
    const { data: meeting, error } = isUuidFormat(codeOrId)
      ? await query.eq('id', codeOrId).maybeSingle()
      : await query.eq('code', codeOrId).maybeSingle();

    if (error || !meeting) {
      return {
        exists: false,
        meeting: null,
        isExpired: false,
        isActive: false,
        isEnded: false,
        daysInactive: 0,
        message: 'Meeting room does not exist yet. You can start it anew.',
      };
    }

    if (meeting.code && meeting.id) {
      codeToUuidCache.set(meeting.code, meeting.id);
    }

    const lastActivity = new Date(
      meeting.last_activity_at || meeting.updated_at || meeting.created_at
    ).getTime();
    const now = Date.now();
    const diffMs = now - lastActivity;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    // Links inactive for more than 30 days are categorized as expired in JUMMP Meet protocol
    const isExpired = diffDays >= 30;

    // 10-Minute Inactivity Rule: If nobody is in the meeting (active_participants_count <= 0) for 10+ minutes
    const isTenMinutesInactive =
      (meeting.active_participants_count <= 0 || !meeting.active_participants_count) &&
      diffMinutes >= 10;
    const isEnded = meeting.status === 'ended' || isTenMinutesInactive;
    const isActive = meeting.status === 'active' && !isEnded && diffMinutes <= 3;

    let message = 'Room is ready to join';
    if (isExpired) {
      message = `This meeting link expired after ${diffDays} days of inactivity.`;
    } else if (isEnded) {
      message = 'This meeting ended due to inactivity (nobody was in the room for 10+ minutes).';
    } else if (isActive) {
      message = 'Meeting is currently live with active participants.';
    }

    return {
      exists: true,
      meeting: meeting as DBMeeting,
      isExpired,
      isActive,
      isEnded,
      daysInactive: diffDays,
      message,
    };
  } catch (err) {
    console.warn('Error checking meeting status:', err);
    return {
      exists: false,
      meeting: null,
      isExpired: false,
      isActive: false,
      isEnded: false,
      daysInactive: 0,
      message: 'Network check failed.',
    };
  }
}

// 1. Create or get existing meeting (with smart reactivation for perpetual links)
export async function createOrGetMeeting(
  code: string,
  hostName: string = 'Host',
  title: string = 'JUMMP Meeting',
  scheduledAt?: string
): Promise<DBMeeting | null> {
  try {
    const query = supabase.from('meetings').select('*');
    const { data: existing } = isUuidFormat(code)
      ? await query.eq('id', code).maybeSingle()
      : await query.eq('code', code).maybeSingle();

    const nowIso = new Date().toISOString();

    if (existing) {
      codeToUuidCache.set(existing.code, existing.id);
      const { data: updated } = await supabase
        .from('meetings')
        .update({
          status: 'active',
          ended_at: null,
          last_activity_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      return (updated as DBMeeting) || (existing as DBMeeting);
    }

    // Insert new meeting
    const { data: created, error } = await supabase
      .from('meetings')
      .insert({
        code,
        title,
        host_name: hostName,
        status: scheduledAt ? 'scheduled' : 'active',
        scheduled_at: scheduledAt || null,
        last_activity_at: nowIso,
        is_locked: false,
        active_participants_count: 1,
      })
      .select('*')
      .single();

    if (error) {
      console.warn('Error inserting meeting into Supabase:', error.message);
      return null;
    }

    if (created) {
      codeToUuidCache.set(created.code, created.id);
    }

    return created as DBMeeting;
  } catch (err) {
    console.warn('Supabase meeting error:', err);
    return null;
  }
}

// 2. Heartbeat to keep meeting active and detect live participants
export async function updateMeetingHeartbeat(codeOrId: string): Promise<void> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid) return;
    await supabase
      .from('meetings')
      .update({
        last_activity_at: new Date().toISOString(),
        status: 'active',
        ended_at: null,
      })
      .eq('id', uuid);
  } catch {}
}

// 3. Mark meeting as ended in Supabase when all hosts leave or terminate
export async function endMeeting(codeOrId: string): Promise<void> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    const now = new Date().toISOString();
    if (uuid) {
      await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: now,
          last_activity_at: now,
          active_participants_count: 0,
        })
        .eq('id', uuid);
    } else {
      await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: now,
          last_activity_at: now,
          active_participants_count: 0,
        })
        .eq('code', codeOrId);
    }
  } catch (err) {
    console.warn('Error ending meeting in DB:', err);
  }
}

// 3b. Activate meeting when a user opens the link
// If meeting was ended by hosts, a non-host guest cannot revive it (returns as ended).
export async function activateMeeting(
  code: string,
  hostName: string = 'Host',
  isHostCaller: boolean = false
): Promise<DBMeeting | null> {
  try {
    const nowIso = new Date().toISOString();
    const query = supabase.from('meetings').select('*');
    const { data: existing } = isUuidFormat(code)
      ? await query.eq('id', code).maybeSingle()
      : await query.eq('code', code).maybeSingle();

    if (existing) {
      codeToUuidCache.set(existing.code, existing.id);

      // If meeting was ended and caller is NOT a host starting the room anew, keep it ended
      if (existing.status === 'ended' && !isHostCaller) {
        return existing as DBMeeting;
      }

      const { data: updated, error } = await supabase
        .from('meetings')
        .update({
          status: 'active',
          ended_at: null,
          last_activity_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (!error && updated) {
        return updated as DBMeeting;
      }
      return existing as DBMeeting;
    }

    // If meeting does not exist yet, create active room
    const { data: created, error } = await supabase
      .from('meetings')
      .insert({
        code,
        title: 'JUMMP Meeting',
        host_name: hostName,
        status: 'active',
        last_activity_at: nowIso,
        is_locked: false,
        active_participants_count: 1,
      })
      .select('*')
      .single();

    if (!error && created) {
      codeToUuidCache.set(created.code, created.id);
      return created as DBMeeting;
    }
    return null;
  } catch (err) {
    console.warn('Error activating meeting:', err);
    return null;
  }
}

// 3c. Persist Webinar Mode state directly to Supabase DB (is_locked boolean column)
export async function setMeetingWebinarMode(codeOrId: string, enabled: boolean): Promise<boolean> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    const now = new Date().toISOString();
    if (uuid) {
      const { error } = await supabase
        .from('meetings')
        .update({
          is_locked: enabled,
          updated_at: now,
        })
        .eq('id', uuid);
      if (!error) return true;
    } else {
      const { error } = await supabase
        .from('meetings')
        .update({
          is_locked: enabled,
          updated_at: now,
        })
        .eq('code', codeOrId);
      if (!error) return true;
    }
    return false;
  } catch (err) {
    console.warn('Error setting webinar mode in DB:', err);
    return false;
  }
}

// 3d. Fetch Webinar Mode state from Supabase DB
export async function getMeetingWebinarMode(codeOrId: string): Promise<boolean> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    const query = supabase.from('meetings').select('is_locked');
    const { data } = uuid
      ? await query.eq('id', uuid).maybeSingle()
      : await query.eq('code', codeOrId).maybeSingle();
    return Boolean(data?.is_locked);
  } catch {
    return false;
  }
}

// Helper to keep active_participants_count synced in Supabase meetings table
export async function updateMeetingParticipantCount(uuid: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('meeting_participants')
      .select('id')
      .eq('meeting_id', uuid)
      .eq('status', 'admitted');
    const count = data ? data.length : 0;
    await supabase
      .from('meetings')
      .update({ active_participants_count: count })
      .eq('id', uuid);
    return count;
  } catch {
    return 0;
  }
}

// 4. Add or update participant (prevents duplicate rows on rejoin and maps UUID accurately)
export async function upsertParticipant(
  codeOrId: string,
  name: string,
  role: 'host' | 'guest' | 'co-host' = 'guest',
  status: 'pending' | 'admitted' | 'denied' | 'left' = 'pending'
): Promise<DBParticipant | null> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid) {
      console.warn('Cannot upsert participant: meeting UUID not found for', codeOrId);
      return null;
    }
    const now = new Date().toISOString();

    // Check if participant already exists for this meeting
    const { data: existing } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', uuid)
      .eq('name', name)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('meeting_participants')
        .update({
          role,
          status,
          last_seen_at: now,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (!error && data) {
        await updateMeetingParticipantCount(uuid);
        return data as DBParticipant;
      }
    }

    const { data, error } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: uuid,
        name,
        role,
        status,
        joined_at: now,
        last_seen_at: now,
      })
      .select('*')
      .single();

    if (error) {
      console.warn('Error adding participant to DB:', error.message);
      return null;
    }

    await updateMeetingParticipantCount(uuid);
    return data as DBParticipant;
  } catch (err) {
    console.warn('Supabase participant error:', err);
    return null;
  }
}

// 4b. Mark participant as left when they disconnect or leave call
export async function markParticipantLeft(
  codeOrId: string,
  name: string
): Promise<void> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid) return;
    const now = new Date().toISOString();
    await supabase
      .from('meeting_participants')
      .update({
        status: 'left',
        last_seen_at: now,
      })
      .eq('meeting_id', uuid)
      .eq('name', name);

    await updateMeetingParticipantCount(uuid);
  } catch (err) {
    console.warn('Error marking participant left:', err);
  }
}

// 4c. Fetch list of active hosts in this meeting from Supabase DB
export async function getActiveHostsInMeeting(codeOrId: string): Promise<string[]> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid) return [];
    const { data, error } = await supabase
      .from('meeting_participants')
      .select('name')
      .eq('meeting_id', uuid)
      .eq('role', 'host')
      .eq('status', 'admitted');

    if (error || !data) return [];
    return data.map((p) => p.name);
  } catch {
    return [];
  }
}

// 4d. Check if a user is registered as a Host in the database
export async function checkIfUserIsHostInDB(codeOrId: string, name: string): Promise<boolean> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid || !name) return false;
    const { data } = await supabase
      .from('meeting_participants')
      .select('role')
      .eq('meeting_id', uuid)
      .eq('name', name.trim())
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.role === 'host';
  } catch {
    return false;
  }
}

// 5. Save chat message to database
export async function saveChatMessage(
  codeOrId: string,
  senderName: string,
  content: string
): Promise<DBMessage | null> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid) return null;
    const { data, error } = await supabase
      .from('meeting_messages')
      .insert({
        meeting_id: uuid,
        sender_name: senderName,
        content,
      })
      .select('*')
      .single();

    if (error) {
      console.warn('Error saving chat message:', error.message);
      return null;
    }

    return data as DBMessage;
  } catch (err) {
    console.warn('Supabase chat error:', err);
    return null;
  }
}

// 6. Fetch recent chat messages
export async function getMeetingMessages(codeOrId: string): Promise<DBMessage[]> {
  try {
    const uuid = await resolveMeetingUuid(codeOrId);
    if (!uuid) return [];
    const { data, error } = await supabase
      .from('meeting_messages')
      .select('*')
      .eq('meeting_id', uuid)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error || !data) return [];
    return data as DBMessage[];
  } catch {
    return [];
  }
}
