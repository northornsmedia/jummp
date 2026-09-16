import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
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
}

export interface DBParticipant {
  id: string;
  meeting_id: string;
  name: string;
  role: 'host' | 'guest' | 'co-host';
  status: 'pending' | 'admitted' | 'denied' | 'left';
  joined_at: string;
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

// Check meeting lifecycle status (e.g. anonymous user clicking link after days or weeks)
export async function checkMeetingStatus(code: string): Promise<MeetingStatusCheck> {
  try {
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', code)
      .maybeSingle();

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
    const { data: existing } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    if (existing) {
      // Perpetual link: If meeting was ended in the past, or accessed weeks later,
      // refresh activity so participants can rejoin smoothly
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
      })
      .select('*')
      .single();

    if (error) {
      console.warn('Error inserting meeting into Supabase:', error.message);
      return null;
    }

    return created as DBMeeting;
  } catch (err) {
    console.warn('Supabase meeting error:', err);
    return null;
  }
}

// 2. Heartbeat to keep meeting active and detect live participants
export async function updateMeetingHeartbeat(meetingId: string): Promise<void> {
  try {
    await supabase
      .from('meetings')
      .update({
        last_activity_at: new Date().toISOString(),
        status: 'active',
        ended_at: null,
      })
      .eq('id', meetingId);
  } catch {}
}

// 3. Mark meeting as ended / inactive when last participant leaves or host terminates
export async function endMeeting(codeOrId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase
      .from('meetings')
      .update({
        status: 'ended',
        ended_at: now,
        last_activity_at: now,
        active_participants_count: 0,
      })
      .or(`id.eq.${codeOrId},code.eq.${codeOrId}`);
  } catch (err) {
    console.warn('Error ending meeting:', err);
  }
}

// 3b. Activate meeting when a user opens the link again (for free & returning users)
export async function activateMeeting(
  code: string,
  hostName: string = 'Host'
): Promise<DBMeeting | null> {
  try {
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (existing) {
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
      })
      .select('*')
      .single();

    if (!error && created) {
      return created as DBMeeting;
    }
    return null;
  } catch (err) {
    console.warn('Error activating meeting:', err);
    return null;
  }
}

// 4. Add or update participant (prevents duplicate rows on rejoin)
export async function upsertParticipant(
  meetingId: string,
  name: string,
  role: 'host' | 'guest' = 'guest',
  status: 'pending' | 'admitted' | 'denied' | 'left' = 'pending'
): Promise<DBParticipant | null> {
  try {
    const now = new Date().toISOString();
    // Check if participant already exists for this meeting
    const { data: existing } = await supabase
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
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
      if (!error && data) return data as DBParticipant;
    }

    const { data, error } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meetingId,
        name,
        role,
        status,
        joined_at: now,
        last_seen_at: now,
      })
      .select('*')
      .single();

    if (error) {
      console.warn('Error adding participant:', error.message);
      return null;
    }

    return data as DBParticipant;
  } catch (err) {
    console.warn('Supabase participant error:', err);
    return null;
  }
}

// 4b. Mark participant as left when they disconnect or leave call
export async function markParticipantLeft(
  meetingId: string,
  name: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase
      .from('meeting_participants')
      .update({
        status: 'left',
        last_seen_at: now,
      })
      .eq('meeting_id', meetingId)
      .eq('name', name);
  } catch (err) {
    console.warn('Error marking participant left:', err);
  }
}

// 5. Save chat message to database
export async function saveChatMessage(
  meetingId: string,
  senderName: string,
  content: string
): Promise<DBMessage | null> {
  try {
    const { data, error } = await supabase
      .from('meeting_messages')
      .insert({
        meeting_id: meetingId,
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
export async function getMeetingMessages(meetingId: string): Promise<DBMessage[]> {
  try {
    const { data, error } = await supabase
      .from('meeting_messages')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error || !data) return [];
    return data as DBMessage[];
  } catch {
    return [];
  }
}
