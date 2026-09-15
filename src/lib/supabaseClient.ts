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
  status: 'scheduled' | 'active' | 'ended';
  scheduled_at?: string | null;
  created_at: string;
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

// 1. Create or get existing meeting
export async function createOrGetMeeting(
  code: string,
  hostName: string = 'Host',
  title: string = 'JUMMP Meeting',
  scheduledAt?: string
): Promise<DBMeeting | null> {
  try {
    // Check if meeting already exists
    const { data: existing } = await supabase
      .from('meetings')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (existing) {
      return existing as DBMeeting;
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

// 2. Add or update participant
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

// 3. Save chat message to database
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

// 4. Fetch recent chat messages
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
