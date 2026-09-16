import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gyqcrrjxrmlnonsppnlp.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5cWNycmp4cm1sbm9uc3BwbmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODUzNTcsImV4cCI6MjEwNTA2MTM1N30.8EE-6YLpE5PBq-aZ6XDdee0XApxizHkLVYMU5paiv4Q';

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

    if (isTenMinutesInactive && meeting.status !== 'ended') {
      supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          active_participants_count: 0,
        })
        .eq('id', meeting.id)
        .then(() => {});
    }

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
      })
      .eq('id', meetingId);
  } catch {}
}

// 3. Mark meeting as ended when last participant leaves or host terminates
export async function endMeeting(meetingId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase
      .from('meetings')
      .update({
        status: 'ended',
        ended_at: now,
        last_activity_at: now,
      })
      .eq('id', meetingId);
  } catch {}
}

// 4. Add or update participant
export async function upsertParticipant(
  meetingId: string,
  name: string,
  role: 'host' | 'guest' = 'guest',
  status: 'pending' | 'admitted' | 'denied' | 'left' = 'pending'
): Promise<DBParticipant | null> {
  try {
    const { data, error } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meetingId,
        name,
        role,
        status,
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
