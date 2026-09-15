export function generateMeetingId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const pick = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `jmp-${pick(4)}-${pick(3)}`;
}

export function parseMeetingId(input: string): string {
  let cleaned = input.trim();
  if (cleaned.includes('/meet/')) {
    cleaned = cleaned.split('/meet/')[1];
  }
  // remove query params or hash
  cleaned = cleaned.split('?')[0].split('#')[0];
  // replace invalid characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  return cleaned;
}

export function getMeetingUrl(meetingId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/meet/${meetingId}`;
  }
  return `https://jummp.womensipalliance.com/meet/${meetingId}`;
}

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
  isScreenSharing: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

export interface JoinRequest {
  id: string;
  name: string;
  meetingId: string;
  requestedAt: number;
}

export interface ScheduledMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  meetingId: string;
  createdAt: number;
}

export function saveScheduledMeeting(meeting: ScheduledMeeting) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getScheduledMeetings();
    const updated = [meeting, ...existing.filter((m) => m.id !== meeting.id)].slice(0, 20);
    localStorage.setItem('jummp_scheduled_meetings', JSON.stringify(updated));
  } catch {}
}

export function getScheduledMeetings(): ScheduledMeeting[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('jummp_scheduled_meetings');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Audio chime using Web Audio API
export function playChime(type: 'knock' | 'admit' | 'chat' = 'knock') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'knock') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'admit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch {}
}

// Helper for cross-tab communication
export class MeetChannel {
  private channel: BroadcastChannel | null = null;

  constructor(private meetingId: string, private onMessage: (msg: any) => void) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`meet-${meetingId}`);
      this.channel.onmessage = (event) => {
        this.onMessage(event.data);
      };
    }
  }

  send(type: string, payload: any) {
    const data = { type, payload, meetingId: this.meetingId };
    if (this.channel) {
      this.channel.postMessage(data);
    }
    // Also use localStorage for cross-window reliability
    try {
      localStorage.setItem(
        `meet_event_${this.meetingId}`,
        JSON.stringify({ ...data, _ts: Date.now() })
      );
    } catch {}
  }

  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}
