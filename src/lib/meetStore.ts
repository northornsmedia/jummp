import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

export function formatTimeAgo(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
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

// Google Meet Tone Generator using Web Audio API
export function playChime(type: 'knock' | 'admit' | 'leave' | 'chat' | 'hand' = 'knock') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === 'admit') {
      // Google Meet signature smooth rising chord
      const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.08);
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } else if (type === 'leave') {
      // Gentle descending two-tone chime
      const freqs = [659.25, 523.25];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.12);
        gain.gain.setValueAtTime(0.1, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.28);
      });
    } else if (type === 'knock') {
      // Gentle double knock tone
      [0, 0.16].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now + delay);
        osc.frequency.exponentialRampToValueAtTime(880, now + delay + 0.1);
        gain.gain.setValueAtTime(0.14, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.005, now + delay + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.22);
      });
    } else if (type === 'hand') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Chat message pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {}
}

// Real-time voice activity detector for live speaking indicator
export function createAudioVisualizer(
  stream: MediaStream,
  onVolume: (vol: number) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return () => {};

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return () => {};

    const ctx = new AudioContextClass();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;
    let isRunning = true;

    const checkAudio = () => {
      if (!isRunning) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Map to 0-100 range
      const normalized = Math.min(100, Math.round((avg / 128) * 100));
      onVolume(normalized);
      animationId = requestAnimationFrame(checkAudio);
    };

    checkAudio();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      try {
        source.disconnect();
        analyser.disconnect();
        ctx.close().catch(() => {});
      } catch {}
    };
  } catch (e) {
    console.warn('Audio visualizer error:', e);
    return () => {};
  }
}

// Helper for cross-device and cross-tab communication (Supabase Realtime + BroadcastChannel)
export class MeetChannel {
  private channel: BroadcastChannel | null = null;
  private supabaseChannel: RealtimeChannel | null = null;

  constructor(private meetingId: string, private onMessage: (msg: any) => void) {
    // 1. Browser BroadcastChannel for instant local tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(`meet-${meetingId}`);
        this.channel.onmessage = (event) => {
          this.onMessage(event.data);
        };
      } catch {}
    }

    // 2. Supabase Realtime channel for internet-wide real-time messaging
    try {
      this.supabaseChannel = supabase
        .channel(`meet:${meetingId}`)
        .on('broadcast', { event: 'meet_event' }, ({ payload }) => {
          this.onMessage(payload);
        })
        .subscribe();
    } catch (e) {
      console.warn('Supabase Realtime channel init error:', e);
    }
  }

  send(type: string, payload: any) {
    const data = { type, payload, meetingId: this.meetingId };

    // Broadcast locally
    if (this.channel) {
      try {
        this.channel.postMessage(data);
      } catch {}
    }

    // Broadcast globally across internet via Supabase WebSockets
    if (this.supabaseChannel) {
      this.supabaseChannel
        .send({
          type: 'broadcast',
          event: 'meet_event',
          payload: data,
        })
        .catch(() => {});
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
      try {
        this.channel.close();
      } catch {}
      this.channel = null;
    }
    if (this.supabaseChannel) {
      try {
        supabase.removeChannel(this.supabaseChannel);
      } catch {}
      this.supabaseChannel = null;
    }
  }
}
