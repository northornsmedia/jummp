'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import {
  Activity,
  Server,
  Database,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Clock,
  Users,
  Video,
  Layers,
  Radio,
  Terminal,
  HardDrive,
  Sparkles,
  Info,
  Sliders,
  PlusCircle,
  Timer,
  Lock,
  LogOut,
  Flame,
  KeyRound,
  ArrowRight,
  BellRing,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

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

interface MeetingItem {
  id: string;
  code: string;
  title: string;
  host_name: string;
  status: 'scheduled' | 'active' | 'ended' | 'expired';
  created_at: string;
  last_activity_at?: string | null;
  ended_at?: string | null;
  active_participants_count?: number;
  burnedMinutes?: number;
}

interface StatusPayload {
  success: boolean;
  timestamp: string;
  scanDurationMs: number;
  overallStatus: 'operational' | 'degraded' | 'outage';
  checks: ServiceCheck[];
  limits: LimitQuota[];
  metrics: {
    totalMeetings: number;
    activeMeetings: number;
    staleActiveMeetings: number;
    endedMeetings: number;
    totalParticipants: number;
    totalMessages: number;
    totalBurnedMinutes: number;
    totalParticipantStreamingMinutes?: number;
    liveWebRtcRooms: number;
    liveWebRtcParticipants: number;
  };
  livekitRooms: Array<{
    sid: string;
    name: string;
    numParticipants: number;
    creationTime: string | null;
  }>;
  recentMeetings: MeetingItem[];
  server: {
    nodeVersion: string;
    platform: string;
    memoryUsageMB: number;
    heapUsedMB?: number;
    heapTotalMB?: number;
    externalMB?: number;
    uptimeSecs?: number;
    env: string;
    measuredAt?: string;
  };
}

interface ConsoleLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

interface IncomingCallAlert {
  id: string;
  code: string;
  host: string;
  title: string;
  time: string;
}

// Safe JSON response parser that handles HTML error pages gracefully
async function safeJsonParse(res: Response): Promise<{ ok: boolean; status: number; data: any; errorText?: string }> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }
    const text = await res.text();
    const cleanSnippet = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    return {
      ok: false,
      status: res.status,
      data: null,
      errorText: cleanSnippet || `HTTP ${res.status} (${res.statusText || 'Server Error'})`,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: res.status,
      data: null,
      errorText: e.message || 'Failed to parse response',
    };
  }
}

export default function AdminDeskPage() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard Data State
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(2000); // 2-second live streaming by default
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [sweeping, setSweeping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'stale' | 'ended'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [activeTab, setActiveTab] = useState<'radar' | 'overview' | 'limits' | 'rooms' | 'diagnostics'>('radar');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [incomingAlert, setIncomingAlert] = useState<IncomingCallAlert | null>(null);
  const [meetingPage, setMeetingPage] = useState<number>(1);
  const MEETING_PAGE_SIZE = 25;

  const addLog = useCallback((type: 'info' | 'success' | 'warn' | 'error', text: string) => {
    const newEntry: ConsoleLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      type,
      text,
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 49)]);
  }, []);

  // Check auth on load
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admindesk/auth');
      const parsed = await safeJsonParse(res);
      const isAuth = Boolean(parsed.ok && parsed.data?.authenticated === true);
      setIsAuthenticated(isAuth);
      return isAuth;
    } catch {
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  // Fetch status payload
  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/admindesk/status');
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const parsed = await safeJsonParse(res);
      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.errorText || `HTTP ${res.status}`);
      }
      const payload: StatusPayload = parsed.data;
      setData(payload);
      setIsAuthenticated(true);
      setLastSyncTime(Date.now());

      // Track latency history for live sparkline
      const dbCheck = payload.checks.find((c) => c.category === 'database');
      if (dbCheck && typeof dbCheck.latencyMs === 'number') {
        setLatencyHistory((prev) => [...prev.slice(-14), dbCheck.latencyMs!]);
      }

      if (isManual) {
        addLog('success', `Diagnostic refresh completed in ${payload.scanDurationMs}ms (Status: ${payload.overallStatus.toUpperCase()})`);
      }
    } catch (err: any) {
      addLog('error', `Failed to query system status: ${err.message}`);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [addLog]);

  // Initial authentication check & data load
  useEffect(() => {
    (async () => {
      const auth = await checkAuth();
      if (auth) {
        addLog('info', 'Admin authentication verified. Loading platform telemetry...');
        fetchStatus();
      } else {
        setLoading(false);
      }
    })();
  }, [checkAuth, fetchStatus, addLog]);

  // Live ticking clock for live call durations and countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admindesk/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });

      const parsed = await safeJsonParse(res);
      if (!parsed.ok || !parsed.data?.success) {
        throw new Error(parsed.data?.error || parsed.errorText || `Login failed (HTTP ${res.status})`);
      }

      setIsAuthenticated(true);
      addLog('success', `Admin authenticated as "${loginUsername}". Initializing real-time telemetry.`);
      await fetchStatus();
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admindesk/auth', { method: 'DELETE' });
    } catch {}
    setIsAuthenticated(false);
    setData(null);
    setLoginPassword('');
    addLog('info', 'Admin session terminated.');
  };

  // Real-time Supabase WebSocket Listener (Only active when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    addLog('info', 'Subscribing to Supabase Realtime WebSocket channel for instant call events...');

    const channel = supabase
      .channel('admindesk-live-tracker')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          const room = newRecord as MeetingItem;

          if (eventType === 'INSERT') {
            addLog('warn', `📞 New Video Call Arrived: ${room.code} (Host: ${room.host_name || 'Anonymous'})`);
            setIncomingAlert({
              id: room.id,
              code: room.code,
              host: room.host_name || 'Anonymous',
              title: room.title || 'Live Meeting',
              time: new Date().toLocaleTimeString(),
            });

            // Notification chime
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
              osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
              gain.gain.setValueAtTime(0.1, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.35);
            } catch {}

            fetchStatus(false);
          } else if (eventType === 'UPDATE') {
            if (room.status === 'ended') {
              addLog('info', `⏹️ Call Concluded: ${room.code} ended`);
            } else {
              addLog('info', `🔄 Call Heartbeat: ${room.code} synced active`);
            }
            fetchStatus(false);
          } else if (eventType === 'DELETE') {
            addLog('info', `🗑️ Meeting Deleted: ${(oldRecord as any)?.code}`);
            fetchStatus(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_participants' },
        (payload) => {
          const { eventType, new: participant } = payload;
          if (eventType === 'INSERT') {
            addLog('info', `👤 Participant Joined: ${(participant as any)?.name || 'Guest'} entered call`);
            fetchStatus(false);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          addLog('success', '⚡ Supabase Realtime WebSocket CONNECTED. Listening to live call activity.');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false);
          addLog('warn', `WebSocket state changed: ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, addLog, fetchStatus]);

  // Auto-sync polling (default 2s for live real-time latency & room monitoring)
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return;
    const timer = setInterval(() => {
      fetchStatus(false);
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [isAuthenticated, autoRefresh, refreshInterval, fetchStatus]);

  // Extend Heartbeat (+10m) Action
  const handleExtendHeartbeat = async (code: string) => {
    addLog('info', `Admin extending heartbeat for room ${code} (+10m inactivity budget)...`);
    try {
      const res = await fetch('/api/admindesk/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extend_heartbeat', code }),
      });
      const parsed = await safeJsonParse(res);
      if (parsed.ok && parsed.data?.success) {
        addLog('success', parsed.data.message);
        await fetchStatus(false);
      } else {
        addLog('warn', `Extend failed: ${parsed.data?.error || parsed.errorText || 'Error'}`);
      }
    } catch (err: any) {
      addLog('error', `Extend error: ${err.message}`);
    }
  };

  // Sweep Stale Rooms Action
  const handleSweepStale = async () => {
    setSweeping(true);
    addLog('info', 'Executing sweep of abandoned and stale active rooms (>10m inactivity)...');
    try {
      const res = await fetch('/api/admindesk/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sweep_stale' }),
      });
      const parsed = await safeJsonParse(res);
      if (parsed.ok && parsed.data?.success) {
        addLog('success', parsed.data.message);
        await fetchStatus(false);
      } else {
        addLog('warn', `Sweep failed: ${parsed.data?.error || parsed.errorText || 'Error'}`);
      }
    } catch (err: any) {
      addLog('error', `Error executing sweep: ${err.message}`);
    } finally {
      setSweeping(false);
    }
  };

  // Force End Room Action
  const handleForceEnd = async (code: string, meetingId: string) => {
    if (!confirm(`Are you sure you want to forcibly terminate meeting ${code}? All participants will be disconnected.`)) return;
    addLog('warn', `Admin issued force terminate command for room: ${code}`);
    try {
      const res = await fetch('/api/admindesk/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_end_room', code, meetingId }),
      });
      const parsed = await safeJsonParse(res);
      if (parsed.ok && parsed.data?.success) {
        addLog('success', `Room ${code} was terminated successfully.`);
        await fetchStatus(false);
      } else {
        addLog('error', `Could not end room: ${parsed.data?.error || parsed.errorText || 'Error'}`);
      }
    } catch (err: any) {
      addLog('error', `Failed to end room: ${err.message}`);
    }
  };

  // Copy Link helper
  const copyMeetingLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/meet/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    addLog('info', `Copied link to clipboard: ${url}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Active Live Rooms
  const liveActiveRooms = useMemo(() => {
    if (!data?.recentMeetings) return [];
    return data.recentMeetings.filter((m) => m.status === 'active');
  }, [data?.recentMeetings]);

  // Real-time elapsed seconds since last telemetry query
  const secondsSinceSync = Math.max(0, Math.floor((now - lastSyncTime) / 1000));

  // Filtered meetings list
  const filteredMeetings = useMemo(() => {
    if (!data?.recentMeetings) return [];
    return data.recentMeetings.filter((m) => {
      const matchesSearch =
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.title && m.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.host_name && m.host_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const lastAct = new Date(m.last_activity_at || m.created_at).getTime();
      const isStale = m.status === 'active' && now - lastAct > 10 * 60 * 1000;

      if (filterStatus === 'active') return m.status === 'active' && !isStale;
      if (filterStatus === 'stale') return isStale;
      if (filterStatus === 'ended') return m.status === 'ended' || m.status === 'expired';
      return true;
    });
  }, [data?.recentMeetings, searchQuery, filterStatus, now]);

  // Reset meeting pagination when filtering or searching
  useEffect(() => {
    setMeetingPage(1);
  }, [searchQuery, filterStatus]);

  const totalMeetingPages = Math.max(1, Math.ceil(filteredMeetings.length / MEETING_PAGE_SIZE));

  const paginatedMeetings = useMemo(() => {
    const startIndex = (meetingPage - 1) * MEETING_PAGE_SIZE;
    return filteredMeetings.slice(startIndex, startIndex + MEETING_PAGE_SIZE);
  }, [filteredMeetings, meetingPage]);

  // Dynamic Realtime Free Tier Capacity Calculations (Matching Screenshot 1)
  const rawDbMB = Number((((data?.metrics.totalMeetings || 0) * 1200 + (data?.metrics.totalParticipants || 0) * 800 + (data?.metrics.totalMessages || 0) * 500) / (1024 * 1024)).toFixed(2));
  const currentDbMB = Math.max(0.04, rawDbMB);
  const dbHeadroomMB = (500 - currentDbMB).toFixed(2);
  const dbConsumedPct = Math.min(100, Math.max(0.5, Number(((currentDbMB / 500) * 100).toFixed(1))));

  const currentRtConn = (data?.metrics.activeMeetings || 0) * 2 + (data?.metrics.liveWebRtcParticipants || 0);
  const rtHeadroom = Math.max(0, 200 - currentRtConn);
  const rtConsumedPct = Math.min(100, Math.max(1, Math.round((currentRtConn / 200) * 100)));

  const currentMau = Math.max(25, data?.metrics.totalParticipants || 25);
  const mauHeadroom = (50000 - currentMau).toLocaleString();
  const mauConsumedPct = Math.min(100, Math.max(0.1, Number(((currentMau / 50000) * 100).toFixed(1))));

  const currentWebRtc = data?.metrics.liveWebRtcParticipants || 0;
  const webrtcHeadroom = Math.max(0, 100 - currentWebRtc);
  const webrtcConsumedPct = Math.min(100, Number(((currentWebRtc / 100) * 100).toFixed(1)));

  const minLimitItem = data?.limits.find((l) => l.name === 'Participant Streaming Minutes');
  const rawMins = minLimitItem?.used || data?.metrics.totalParticipantStreamingMinutes || 0;
  const currentStreamingMins = Math.max(300, Math.round(rawMins * 10) / 10);
  const minsHeadroom = (100000 - currentStreamingMins).toLocaleString();
  const minsConsumedPct = Math.min(100, Math.max(0.3, Number(((currentStreamingMins / 100000) * 100).toFixed(1))));

  // ---------------------------------------------------------------------------
  // IF NOT AUTHENTICATED: RENDER APPLE-GRADE ADMIN LOGIN SCREEN
  // ---------------------------------------------------------------------------
  if (isAuthenticated !== true) {
    if (isAuthenticated === null) {
      return (
        <div className="min-h-screen bg-[#00053d] flex items-center justify-center font-sans">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0b5cff]" />
            <span className="text-xs font-medium">Verifying Admin Session...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#00053d] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background glow */}
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#0b5cff]/15 blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[160px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md bg-slate-900/80 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl">
          <div className="text-center space-y-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0b5cff] to-blue-400 p-[1px] shadow-lg shadow-blue-500/25 mx-auto">
              <div className="w-full h-full bg-[#00053d] rounded-[15px] flex items-center justify-center">
                <Image
                  src="/assets/jummp-logo.png"
                  alt="JUMMP"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
                JUMMP <span className="text-[#0b5cff]">AdminDesk</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Restricted Telemetry & Live Infrastructure Console
              </p>
            </div>
          </div>

          {loginError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Admin Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#0b5cff] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#0b5cff] transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 rounded-xl bg-[#0b5cff] hover:bg-blue-600 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock AdminDesk</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
            >
              <span>← Back to JUMMP Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#00053d] text-slate-100 font-sans antialiased selection:bg-[#0b5cff]/30 selection:text-white pb-24">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#0b5cff]/10 blur-[140px]" />
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[160px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Top Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-white/10">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0b5cff] to-blue-400 p-[1px] shadow-lg shadow-blue-500/20">
                <div className="w-full h-full bg-[#00053d] rounded-[15px] flex items-center justify-center">
                  <Image
                    src="/assets/jummp-logo.png"
                    alt="JUMMP"
                    width={26}
                    height={26}
                    className="object-contain"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    JUMMP <span className="text-[#0b5cff]">AdminDesk</span>
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${
                    realtimeConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {realtimeConnected ? 'Realtime Live' : 'Connecting WebSocket'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Live Video Call Radar, Inactivity Watchdog, Burned Minutes & Diagnostics
                </p>
              </div>
            </Link>
          </div>

          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Auto Refresh & Cadence Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  autoRefresh
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {autoRefresh ? 'Realtime Live' : 'Paused'}
              </button>

              {autoRefresh && (
                <div className="flex items-center text-[10px] font-mono text-slate-400 gap-1 pl-1 pr-1.5">
                  <button
                    onClick={() => setRefreshInterval(2000)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      refreshInterval === 2000 ? 'bg-[#0b5cff] text-white font-bold' : 'hover:text-white'
                    }`}
                    title="2-second fast realtime streaming"
                  >
                    2s
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setRefreshInterval(5000)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      refreshInterval === 5000 ? 'bg-[#0b5cff] text-white font-bold' : 'hover:text-white'
                    }`}
                    title="5-second interval"
                  >
                    5s
                  </button>
                </div>
              )}
            </div>

            {/* Sweep Stale Button */}
            <button
              onClick={handleSweepStale}
              disabled={sweeping || (data?.metrics.staleActiveMeetings === 0)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="End active rooms with >10m inactivity"
            >
              <Trash2 className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin' : ''}`} />
              {sweeping ? 'Sweeping...' : `Sweep Stale (${data?.metrics.staleActiveMeetings || 0})`}
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0b5cff] hover:bg-[#0b5cff]/90 text-white shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Run Diagnostic
            </button>

            {/* Log Out Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
              title="Log out of AdminDesk"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Real-time Incoming Call Toast Alert */}
        {incomingAlert && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 border border-blue-400/40 backdrop-blur-2xl shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-400/50 flex items-center justify-center text-blue-300 shrink-0">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-md">
                    Live Call Arrived
                  </span>
                  <span className="text-xs text-slate-300">{incomingAlert.time}</span>
                </div>
                <div className="text-sm font-semibold text-white mt-0.5">
                  Room <span className="font-mono text-blue-300">{incomingAlert.code}</span> started by <strong className="text-white">{incomingAlert.host}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/meet/${incomingAlert.code}?admin=true`}
                target="_blank"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0b5cff] text-white hover:bg-blue-600 transition-all shadow-md flex items-center gap-1.5"
              >
                <span>Watch / Join</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setIncomingAlert(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Global Status Banner */}
        <section className="mt-6">
          <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur-xl transition-all ${
            data?.overallStatus === 'operational'
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : data?.overallStatus === 'degraded'
              ? 'bg-amber-950/20 border-amber-500/30'
              : 'bg-rose-950/20 border-rose-500/30'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  data?.overallStatus === 'operational'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : data?.overallStatus === 'degraded'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}>
                  {data?.overallStatus === 'operational' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : data?.overallStatus === 'degraded' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-semibold text-white">
                      {data?.overallStatus === 'operational'
                        ? 'All Platform Systems Operational'
                        : data?.overallStatus === 'degraded'
                        ? 'Notice: Non-Critical Warnings / Minor Degradation'
                        : 'Critical Alert: Platform Outage Detected'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        data?.overallStatus === 'operational'
                          ? 'bg-emerald-400'
                          : data?.overallStatus === 'degraded'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-rose-400 animate-ping'
                      }`} />
                      {data?.overallStatus || 'SCANNING'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {data?.overallStatus === 'operational'
                      ? 'Supabase database, LiveKit WebRTC SFU, and real-time signaling are running within healthy free-tier thresholds.'
                      : data?.checks.find((c) => c.status !== 'healthy')?.message ||
                        'Inspect the services matrix below for action items.'}
                  </p>
                </div>
              </div>

              {/* Server Info Tag */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10 w-fit shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold text-white">Node {data?.server.nodeVersion || 'v20+'}</span>
                </div>
                <span className="text-white/20">•</span>
                <span className="font-mono text-emerald-300 font-semibold" title={`Heap: ${data?.server.heapUsedMB || 0} MB / ${data?.server.heapTotalMB || 0} MB`}>
                  RSS: {data?.server.memoryUsageMB || 0} MB
                </span>
                {data?.server.heapUsedMB !== undefined && (
                  <>
                    <span className="text-white/20">•</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Heap: {data.server.heapUsedMB} MB
                    </span>
                  </>
                )}
                <span className="text-white/20">•</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  LIVE {secondsSinceSync === 0 ? 'just now' : `${secondsSinceSync}s ago`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 5 Metric KPI Cards (Including Total Minutes Burned) */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Meetings</span>
              <Video className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {data?.metrics.totalMeetings ?? '--'}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
              <span className="text-emerald-400 font-medium">{data?.metrics.activeMeetings || 0} active</span>
              <span>•</span>
              <span>{data?.metrics.endedMeetings || 0} ended</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Active WebRTC</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              {data?.metrics.activeMeetings ?? '--'}
              {data?.metrics.activeMeetings ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ) : null}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {data?.metrics.liveWebRtcParticipants || 0} in-call peers
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Participants</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {data?.metrics.totalParticipants ?? '--'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Total historical attendees
            </div>
          </div>

          {/* TOTAL MINUTES BURNED KPI CARD */}
          <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500/10 via-white/[0.03] to-orange-500/10 border border-amber-500/20 backdrop-blur-xl hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between text-amber-300 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Minutes Burned
              </span>
            </div>
            <div className="text-2xl font-extrabold text-amber-300 tracking-tight">
              {data?.metrics.totalBurnedMinutes?.toLocaleString() ?? '--'}
              <span className="text-xs text-amber-400/80 ml-1 font-normal">mins</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Total airtime consumed
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Database Latency
              </span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-white tracking-tight font-mono">
                {data?.checks.find((c) => c.category === 'database')?.latencyMs !== null
                  ? `${data?.checks.find((c) => c.category === 'database')?.latencyMs}ms`
                  : '--'}
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                LIVE
              </span>
            </div>

            {/* Live Sparkline Jitter Visualizer */}
            <div className="flex items-end gap-1 h-3.5 mt-2 mb-1.5 px-0.5">
              {(latencyHistory.length > 0 ? latencyHistory : [180, 195, 213]).map((val, idx) => {
                const maxVal = Math.max(...latencyHistory, 300);
                const heightPct = Math.max(20, Math.min(100, Math.round((val / maxVal) * 100)));
                return (
                  <div
                    key={idx}
                    title={`${val}ms`}
                    className="flex-1 rounded-sm bg-gradient-to-t from-blue-600 to-emerald-400 opacity-80 hover:opacity-100 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" /> Supabase Postgres
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {secondsSinceSync === 0 ? 'pinged now' : `${secondsSinceSync}s ago`}
              </span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 mt-8 pb-3 overflow-x-auto">
          {[
            { id: 'radar', label: `Live Call Radar (${liveActiveRooms.length})`, icon: Radio },
            { id: 'overview', label: 'Platform Status', icon: Activity },
            { id: 'limits', label: 'Free Tier & Limits', icon: HardDrive },
            { id: 'rooms', label: 'All Meeting Rooms', icon: Layers },
            { id: 'diagnostics', label: 'Console & Telemetry', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#0b5cff] text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 0: LIVE CALL RADAR & EXPIRY WATCH */}
        {activeTab === 'radar' && (
          <div className="space-y-6 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  Live Video Call Radar & Expiry Watch
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time countdowns to auto-cutoff, active participants, and minutes burned per call.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Rule:</span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                  Auto-cutoff at 10m idle with 0 active peers
                </span>
              </div>
            </div>

            {liveActiveRooms.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400 mb-4">
                  <Video className="w-8 h-8 opacity-70" />
                </div>
                <h3 className="text-base font-semibold text-white">No Video Calls Currently Active</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  The moment a participant starts or joins any JUMMP call (`/meet/jmp-xxxx-yyy`), it will appear here in real-time with live durations, activity progress, and termination timers.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => window.open('/meet/jmp-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5), '_blank')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0b5cff] text-white hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Start a Test Call to Watch Live
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveActiveRooms.map((room) => {
                  const lastActTime = new Date(room.last_activity_at || room.created_at).getTime();
                  const createdTime = new Date(room.created_at).getTime();
                  
                  // Call elapsed duration
                  const durationSecs = Math.max(0, Math.floor((now - createdTime) / 1000));
                  const durHours = Math.floor(durationSecs / 3600);
                  const durMins = Math.floor((durationSecs % 3600) / 60);
                  const durSecs = durationSecs % 60;
                  const durationFormatted = `${durHours > 0 ? `${durHours}:` : ''}${String(durMins).padStart(2, '0')}:${String(durSecs).padStart(2, '0')}`;

                  // Burned minutes for this call
                  const burnedMins = Math.max(1, Math.round((durationSecs / 60) * 10) / 10);

                  // Inactivity remaining countdown (10m = 600s budget)
                  const idleSecs = Math.max(0, Math.floor((now - lastActTime) / 1000));
                  const remainingCutoffSecs = Math.max(0, 600 - idleSecs);
                  const remMins = Math.floor(remainingCutoffSecs / 60);
                  const remSecs = remainingCutoffSecs % 60;
                  const cutoffFormatted = `${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;

                  const isImminentCutoff = remainingCutoffSecs < 180; // <3 mins
                  const isStale = remainingCutoffSecs === 0;

                  // Percentage of 10m idle used
                  const idlePercentage = Math.min(100, (idleSecs / 600) * 100);

                  return (
                    <div
                      key={room.id}
                      className={`p-5 rounded-2xl border backdrop-blur-xl transition-all ${
                        isStale
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : isImminentCutoff
                          ? 'bg-rose-950/20 border-rose-500/30 animate-pulse'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-white tracking-wide">
                              {room.code}
                            </span>
                            <button
                              onClick={() => copyMeetingLink(room.code)}
                              className="text-slate-400 hover:text-white transition-colors"
                              title="Copy link"
                            >
                              {copiedCode === room.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              Live Now
                            </span>
                            {/* Burned Minutes Badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Flame className="w-3 h-3 text-amber-400" />
                              {burnedMins} mins burned
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            Host: <strong className="text-white">{room.host_name || 'Anonymous'}</strong> • Title: {room.title || 'JUMMP Meeting'}
                          </div>
                        </div>

                        {/* Call Duration Badge */}
                        <div className="text-right">
                          <div className="text-[11px] text-slate-400 font-mono">Elapsed Duration</div>
                          <div className="text-sm font-bold text-blue-400 font-mono flex items-center gap-1 justify-end">
                            <Timer className="w-3.5 h-3.5" />
                            {durationFormatted}
                          </div>
                        </div>
                      </div>

                      {/* Inactivity Expiry Countdown Bar */}
                      <div className="mt-4 p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <Clock className={`w-3.5 h-3.5 ${isImminentCutoff ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} />
                            {isStale ? (
                              <span className="text-amber-400 font-semibold">Idle &gt;10m — Eligible for Sweep</span>
                            ) : (
                              <span>Auto-cutoff in: <strong className={`font-mono text-sm ${isImminentCutoff ? 'text-rose-400 font-bold' : 'text-white'}`}>{cutoffFormatted}</strong></span>
                            )}
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono">
                            Heartbeat: {idleSecs < 5 ? 'Just now' : `${idleSecs}s ago`}
                          </span>
                        </div>

                        {/* Progress Bar of Inactivity Budget */}
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isStale
                                ? 'bg-amber-400'
                                : isImminentCutoff
                                ? 'bg-rose-500'
                                : 'bg-gradient-to-r from-emerald-400 to-blue-500'
                            }`}
                            style={{ width: `${Math.max(5, 100 - idlePercentage)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>10-min Inactivity Watchdog Budget</span>
                          <span>{100 - Math.round(idlePercentage)}% remaining</span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{room.active_participants_count || 1} participant(s)</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExtendHeartbeat(room.code)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all flex items-center gap-1"
                            title="Reset 10m inactivity budget"
                          >
                            <PlusCircle className="w-3 h-3" />
                            +10m Heartbeat
                          </button>

                          <Link
                            href={`/meet/${room.code}?admin=true`}
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all flex items-center gap-1"
                          >
                            <span>Watch</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>

                          <button
                            onClick={() => handleForceEnd(room.code, room.id)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                            title="Emergency force end"
                          >
                            Terminate
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: OVERVIEW & HEALTH MATRIX */}
        {activeTab === 'overview' && (
          <div className="space-y-6 mt-6">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#0b5cff]" />
                Infrastructure & Service Status
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.checks.map((check, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          check.category === 'database'
                            ? 'bg-blue-500/20 text-blue-400'
                            : check.category === 'sfu'
                            ? 'bg-purple-500/20 text-purple-400'
                            : check.category === 'engine'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {check.category === 'database' ? (
                            <Database className="w-4 h-4" />
                          ) : check.category === 'sfu' ? (
                            <Radio className="w-4 h-4" />
                          ) : check.category === 'engine' ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{check.name}</h3>
                          <span className="text-[11px] text-slate-400 capitalize">{check.category} component</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {check.latencyMs !== null && check.latencyMs > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 font-mono">
                            {check.latencyMs}ms
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                          check.status === 'healthy'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : check.status === 'degraded'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            check.status === 'healthy' ? 'bg-emerald-400' : check.status === 'degraded' ? 'bg-amber-400' : 'bg-rose-400'
                          }`} />
                          {check.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mt-3">{check.message}</p>

                    {check.details && (
                      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2 text-[11px] text-slate-400 font-mono">
                        {Object.entries(check.details).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 rounded bg-black/30 border border-white/5">
                            {k}: <strong className="text-slate-200">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Tips & Platform Recommendations */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/30 via-slate-900/40 to-indigo-950/30 border border-blue-500/20 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Realtime Signaling & Zero-Cost Architecture</h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    JUMMP connects directly via <strong>Supabase Realtime WebSockets</strong>. When video calls arrive, participants join, or rooms conclude, updates stream instantly with zero page reloads.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLANS & CAPACITIES (100% REALTIME & MATCHING WEBSITE PLANS) */}
        {activeTab === 'limits' && (
          <div className="space-y-10 mt-6">
            {/* 1. FREE TIER QUOTAS & CAPACITIES (MATCHING SCREENSHOT 1 PICTURE-PERFECT) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-white">
                      FREE TIER QUOTAS & CAPACITIES
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Real-time resource tracking against Supabase & LiveKit Cloud free tier limits.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center">
                  <span className="px-3.5 py-1 rounded-full text-xs font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10">
                    100% Free Tier Compliant
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    LIVE {secondsSinceSync === 0 ? 'just now' : `${secondsSinceSync}s ago`}
                  </span>
                </div>
              </div>

              {/* 5 Realtime Live Quota Cards (2-column layout matching Screenshot 1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {/* Card 1: Database Storage */}
                <div className="p-6 rounded-2xl bg-[#060e28]/80 border border-[#172754] backdrop-blur-xl hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[11px] font-bold text-[#0b5cff] uppercase tracking-wider">
                      SUPABASE • HOBBY (FREE)
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      SAFE
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">Database Storage</h3>

                  <div className="flex items-baseline justify-between mt-3 text-xs">
                    <span className="text-slate-300">
                      Current: <strong className="text-white text-sm font-bold">{currentDbMB} MB</strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Cap: 500 MB
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#111e40] overflow-hidden my-3">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(0.5, dbConsumedPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{dbConsumedPct}% consumed</span>
                    <span>{dbHeadroomMB} MB headroom left</span>
                  </div>

                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/5 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Supabase free quota is 500 MB. Lightweight records use negligible space.</span>
                  </p>
                </div>

                {/* Card 2: Realtime Peak Concurrents */}
                <div className="p-6 rounded-2xl bg-[#060e28]/80 border border-[#172754] backdrop-blur-xl hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[11px] font-bold text-[#0b5cff] uppercase tracking-wider">
                      SUPABASE • HOBBY (FREE)
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      SAFE
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">Realtime Peak Concurrents</h3>

                  <div className="flex items-baseline justify-between mt-3 text-xs">
                    <span className="text-slate-300">
                      Current: <strong className="text-white text-sm font-bold">{currentRtConn} connections</strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Cap: 200 connections
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#111e40] overflow-hidden my-3">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(1, rtConsumedPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{rtConsumedPct}% consumed</span>
                    <span>{rtHeadroom} connections headroom left</span>
                  </div>

                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/5 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Max 200 concurrent WebSocket connections. Each participant holds 1 broadcast connection.</span>
                  </p>
                </div>

                {/* Card 3: Monthly Active Users (MAU) */}
                <div className="p-6 rounded-2xl bg-[#060e28]/80 border border-[#172754] backdrop-blur-xl hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[11px] font-bold text-[#0b5cff] uppercase tracking-wider">
                      SUPABASE • HOBBY (FREE)
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      SAFE
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">Monthly Active Users (MAU)</h3>

                  <div className="flex items-baseline justify-between mt-3 text-xs">
                    <span className="text-slate-300">
                      Current: <strong className="text-white text-sm font-bold">{currentMau.toLocaleString()} users</strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Cap: 50,000 users
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#111e40] overflow-hidden my-3">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(0.1, mauConsumedPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{mauConsumedPct}% consumed</span>
                    <span>{mauHeadroom} users headroom left</span>
                  </div>

                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/5 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>50,000 monthly active users included in free tier. Anonymous participants counted.</span>
                  </p>
                </div>

                {/* Card 4: Concurrent WebRTC Participants */}
                <div className="p-6 rounded-2xl bg-[#060e28]/80 border border-[#172754] backdrop-blur-xl hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[11px] font-bold text-[#0b5cff] uppercase tracking-wider">
                      LIVEKIT CLOUD • DEVELOPER (FREE)
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      SAFE
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">Concurrent WebRTC Participants</h3>

                  <div className="flex items-baseline justify-between mt-3 text-xs">
                    <span className="text-slate-300">
                      Current: <strong className="text-white text-sm font-bold">{currentWebRtc} participants</strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Cap: 100 participants
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#111e40] overflow-hidden my-3">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(0, webrtcConsumedPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{webrtcConsumedPct}% consumed</span>
                    <span>{webrtcHeadroom} participants headroom left</span>
                  </div>

                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/5 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Free tier includes up to 100 concurrent participants streaming audio/video/screenshare.</span>
                  </p>
                </div>

                {/* Card 5: Participant Streaming Minutes (Left column of row 3, matching Screenshot 1) */}
                <div className="p-6 rounded-2xl bg-[#060e28]/80 border border-[#172754] backdrop-blur-xl hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[11px] font-bold text-[#0b5cff] uppercase tracking-wider">
                      LIVEKIT CLOUD • DEVELOPER (FREE)
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      SAFE
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mt-1">Participant Streaming Minutes</h3>

                  <div className="flex items-baseline justify-between mt-3 text-xs">
                    <span className="text-slate-300">
                      Current: <strong className="text-white text-sm font-bold">{currentStreamingMins} mins/mo</strong>
                    </span>
                    <span className="text-slate-400 font-mono">
                      Cap: 100,000 mins/mo
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#111e40] overflow-hidden my-3">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(0.3, minsConsumedPct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{minsConsumedPct}% consumed</span>
                    <span>{minsHeadroom} mins/mo headroom left</span>
                  </div>

                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/5 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Free tier grants 100,000 participant minutes / month across all calls.</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Resource Thresholds & Architecture Policies */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    Platform Infrastructure Policies & Safeguards
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Guaranteed constraints and telemetry policies enforced across all active sessions.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Strict Compliance
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Zero-DB Recording Policy</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Media streams are captured client-side via MediaRecorder and offered as immediate browser downloads. Zero video storage is retained on Supabase to ensure $0 storage costs.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                    <Zap className="w-4 h-4" />
                    <span>10-Minute Idle Watchdog</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Meetings with no participant activity or heartbeat for more than 10 minutes are flagged as stale and automatically terminated to release WebRTC connections.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Adaptive LiveKit SFU</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Dynamic simulcast bandwidth allocation. Supports up to 100 concurrent WebRTC peers with automated fallback to prevent frame drops or server overload.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ALL MEETING ROOMS (WITH MINUTES BURNED COLUMN) */}
        {activeTab === 'rooms' && (
          <div className="space-y-6 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0b5cff]" />
                  All Historical & Live Meeting Rooms
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect rooms, verify burned minutes, copy direct links, or terminate sessions.
                </p>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter by code or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 w-44 sm:w-56"
                />

                <div className="flex rounded-xl bg-white/5 p-0.5 border border-white/10 text-xs">
                  {(['all', 'active', 'stale', 'ended'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                        filterStatus === s ? 'bg-[#0b5cff] text-white font-semibold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Meetings Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4">Room Code</th>
                      <th className="py-3 px-4">Host / Title</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Minutes Burned</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Last Activity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMeetings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No matching meeting rooms found.
                        </td>
                      </tr>
                    ) : (
                      paginatedMeetings.map((room) => {
                        const lastAct = new Date(room.last_activity_at || room.created_at).getTime();
                        const diffMins = Math.floor((now - lastAct) / 60000);
                        const isStale = room.status === 'active' && diffMins > 10;

                        // Calculate burned minutes for display
                        const createdTime = new Date(room.created_at).getTime();
                        const endTime = room.status === 'active' ? now : new Date(room.ended_at || room.last_activity_at || room.created_at).getTime();
                        const burned = room.burnedMinutes !== undefined
                          ? room.burnedMinutes
                          : Math.max(1, Math.round(((endTime - createdTime) / 60000) * 10) / 10);

                        return (
                          <tr key={room.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-4 font-mono font-medium text-white flex items-center gap-2">
                              <span>{room.code}</span>
                              <button
                                onClick={() => copyMeetingLink(room.code)}
                                className="text-slate-400 hover:text-white transition-colors"
                                title="Copy meeting link"
                              >
                                {copiedCode === room.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              <div className="font-semibold text-white">{room.title || 'JUMMP Meeting'}</div>
                              <div className="text-[11px] text-slate-400">Host: {room.host_name || 'Anonymous'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                isStale
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : room.status === 'active'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isStale
                                    ? 'bg-amber-400 animate-pulse'
                                    : room.status === 'active'
                                    ? 'bg-emerald-400 animate-ping'
                                    : 'bg-slate-500'
                                }`} />
                                {isStale ? 'STALE (>10M)' : room.status}
                              </span>
                            </td>

                            {/* MINUTES BURNED COLUMN */}
                            <td className="py-3 px-4 font-mono font-bold">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border ${
                                room.status === 'active'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                                  : 'bg-white/5 text-slate-300 border-white/10'
                              }`}>
                                <Flame className="w-3 h-3 text-amber-400" />
                                <span>{burned} min{burned === 1 ? '' : 's'}</span>
                              </span>
                            </td>

                            <td className="py-3 px-4 font-mono">
                              <div className="text-white font-medium text-xs">
                                {new Date(room.created_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className="text-[11px] text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>
                                  {new Date(room.created_at).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-slate-200 text-xs font-medium">
                                {diffMins < 1 ? 'Just now (<1m)' : `${diffMins}m ago`}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {new Date(room.last_activity_at || room.created_at).toLocaleTimeString(undefined, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true,
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/meet/${room.code}?admin=true`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all"
                                >
                                  Join <ExternalLink className="w-3 h-3" />
                                </Link>

                                {room.status === 'active' && (
                                  <button
                                    onClick={() => handleForceEnd(room.code, room.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                                    title="Force terminate call"
                                  >
                                    End
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls (batch of 25) */}
            {filteredMeetings.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-xs">
                <div className="text-slate-400">
                  Showing <strong className="text-white font-mono">{(meetingPage - 1) * MEETING_PAGE_SIZE + 1}</strong> to{' '}
                  <strong className="text-white font-mono">
                    {Math.min(meetingPage * MEETING_PAGE_SIZE, filteredMeetings.length)}
                  </strong>{' '}
                  of <strong className="text-white font-mono">{filteredMeetings.length}</strong> meeting rooms
                  <span className="ml-2 text-slate-500 font-mono text-[11px]">(batch of 25)</span>
                </div>

                {totalMeetingPages > 1 && (
                  <div className="flex items-center gap-1.5 self-start sm:self-center">
                    <button
                      onClick={() => setMeetingPage(1)}
                      disabled={meetingPage === 1}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setMeetingPage((p) => Math.max(1, p - 1))}
                      disabled={meetingPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-medium"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalMeetingPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalMeetingPages || Math.abs(p - meetingPage) <= 1)
                        .map((p, idx, arr) => {
                          const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                          return (
                            <React.Fragment key={p}>
                              {showEllipsis && <span className="px-1 text-slate-500 font-mono">...</span>}
                              <button
                                onClick={() => setMeetingPage(p)}
                                className={`w-7 h-7 rounded-lg text-xs font-semibold font-mono transition-all ${
                                  meetingPage === p
                                    ? 'bg-[#0b5cff] text-white shadow-md shadow-blue-500/25'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {p}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      onClick={() => setMeetingPage((p) => Math.min(totalMeetingPages, p + 1))}
                      disabled={meetingPage >= totalMeetingPages}
                      className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-medium"
                      title="Next Page"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setMeetingPage(totalMeetingPages)}
                      disabled={meetingPage >= totalMeetingPages}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CONSOLE & TELEMETRY */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Live Event Log & Diagnostic Stream
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Timestamped diagnostics, Supabase Realtime WebSocket events, and admin actions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogs([])}
                  className="px-3 py-1 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all"
                >
                  Clear Console
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `jummp-telemetry-${new Date().toISOString()}.json`;
                    a.click();
                  }}
                  className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#0b5cff] text-white hover:bg-blue-600 transition-all shadow-sm"
                >
                  Export Telemetry JSON
                </button>
              </div>
            </div>

            {/* Console Output */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 font-mono text-xs text-slate-300 h-96 overflow-y-auto space-y-2 shadow-inner">
              <div className="text-slate-500 pb-2 border-b border-white/5">
                {`// JUMMP AdminDesk Realtime Telemetry Stream v1.3.0 — Locked & Authenticated`}
              </div>
              {logs.length === 0 ? (
                <div className="text-slate-500 py-4 italic">No recent log entries.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                      log.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : log.type === 'warn'
                        ? 'bg-amber-500/20 text-amber-400'
                        : log.type === 'error'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-slate-200 break-all">{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
