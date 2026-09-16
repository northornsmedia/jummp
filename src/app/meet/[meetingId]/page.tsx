'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  MessageSquare,
  Users,
  Info,
  PhoneOff,
  Copy,
  Check,
  Smile,
  Send,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
  Shield,
  ShieldCheck,
  ArrowLeft,
  Settings,
  MoreVertical,
  Bell,
  Sparkles,
  RotateCcw,
  Home,
  Play,
  RefreshCw,
  Clock,
  AlertCircle,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Disc,
  Download,
  Pause,
  Square,
  Circle,
  X,
  FileText,
  Trash2,
  Edit3,
  Plus,
  QrCode,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  MeetChannel,
  Participant,
  ChatMessage,
  JoinRequest,
  getMeetingUrl,
  playChime,
  formatTimeAgo,
  createAudioVisualizer,
  triggerHaptic,
} from '@/lib/meetStore';
import {
  createAnonymousMeeting,
  getHostCapability,
  verifyHostCapability,
} from '@/lib/meetingSession';
import {
  createOrGetMeeting,
  saveChatMessage,
  getMeetingMessages,
  checkMeetingStatus,
  upsertParticipant,
  markParticipantLeft,
  DBMeeting,
  MeetingStatusCheck,
} from '@/lib/supabaseClient';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track } from 'livekit-client';

// Helper to format spoken speech into clean, readable lines within paragraphs
function formatSpokenText(text: string, maxLineLength = 65): string {
  if (!text) return '';
  const paragraphs = text.split('\n');
  return paragraphs
    .map((paragraph) => {
      const words = paragraph.trim().split(/\s+/);
      if (words.length === 0) return '';
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if (
          currentLine.length + 1 + word.length > maxLineLength &&
          currentLine.length >= 35
        ) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine += ' ' + word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines.join('\n');
    })
    .join('\n');
}

function MeetContent({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const router = useRouter();

  // Meeting Lifecycle & Status
  const [statusCheck, setStatusCheck] = useState<MeetingStatusCheck | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [dbMeeting, setDbMeeting] = useState<DBMeeting | null>(null);

  // Call phases
  const [inCall, setInCall] = useState(false);
  const [waitingToJoin, setWaitingToJoin] = useState(false);
  const [denied, setDenied] = useState(false);
  const [hostInMeeting, setHostInMeeting] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  // Media Controls
  const [userName, setUserName] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenPreview, setShowScreenPreview] = useState(false);
  const [activeScreenSharer, setActiveScreenSharer] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0); // 0-100 live voice volume
  const [isResyncing, setIsResyncing] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [locallyMutedAudio, setLocallyMutedAudio] = useState<Record<string, boolean>>({});
  const [locallyMutedVideo, setLocallyMutedVideo] = useState<Record<string, boolean>>({});

  // 10-Minute Inactivity Watchdog ("Are you still here?")
  const [showStillHereModal, setShowStillHereModal] = useState(false);
  const [stillHereCountdown, setStillHereCountdown] = useState(60);
  const aloneSinceRef = useRef<number | null>(null);

  // Browser-Side Recording State (MediaRecorder)
  const [isRecording, setIsRecording] = useState(false);
  const [isPausedRecording, setIsPausedRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRoomRecording, setIsRoomRecording] = useState(false);
  const [recordingBy, setRecordingBy] = useState<string>('Host');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [hasDownloadedRecording, setHasDownloadedRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Video Refs & Streams
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const inCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Remote WebRTC Streams & Screen Sharing
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenTrackIdRef = useRef<string | null>(null);
  const remoteScreenStreamIdRef = useRef<string | null>(null);
  const activeScreenSharerRef = useRef<string | null>(null);
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const remoteWebcamTracksRef = useRef<Record<string, MediaStreamTrack>>({});
  const remoteScreenStreamRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Record<string, RTCRtpSender>>({});
  const screenAudioSendersRef = useRef<Record<string, RTCRtpSender>>({});
  const pendingCandidatesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  // LiveKit SFU Ref
  const livekitRoomRef = useRef<Room | null>(null);

  // Meeting State
  const [isHost, setIsHost] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [hostResolved, setHostResolved] = useState(false);
  const [admissionToken, setAdmissionToken] = useState<string | null>(null);
  const [participantId] = useState(() => crypto.randomUUID());
  const [transportMode, setTransportMode] = useState<'checking' | 'livekit' | 'p2p'>('checking');
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Deduplicated remote participants list (strictly eliminates duplicate tiles and excludes local self/host)
  const otherParticipants = useMemo(() => {
    const myNormalized = (userName || (isHost ? 'Host' : '')).trim().toLowerCase();

    // Deduplicate strictly by normalized lowercase name and merge to retain host/audio/video flags
    const byName = new Map<string, Participant>();

    for (const p of participants) {
      const pNormalized = (p.name || '').trim().toLowerCase();
      if (!pNormalized) continue;

      // Strictly skip the local user (prevents host or user seeing self as a remote tile)
      if (pNormalized === myNormalized) continue;
      // If we are the host, skip any participant marked as host or named 'host'
      if (isHost && (p.isHost || pNormalized === 'host')) continue;

      const existing = byName.get(pNormalized);
      if (!existing) {
        byName.set(pNormalized, { ...p, name: p.name.trim() });
      } else {
        // Merge so we retain isHost: true and active settings without creating duplicate tiles
        byName.set(pNormalized, {
          ...existing,
          ...p,
          name: p.name.trim() || existing.name,
          isHost: Boolean(existing.isHost || p.isHost || pNormalized === 'host'),
          audioEnabled: existing.audioEnabled ?? p.audioEnabled ?? true,
          videoEnabled: existing.videoEnabled ?? p.videoEnabled ?? true,
        });
      }
    }

    return Array.from(byName.values());
  }, [participants, userName, isHost]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'JUMMP Bot', text: 'Welcome to JUMMP Meet. Call is encrypted and ready.', time: 'Just now' },
  ]);
  const [newChatText, setNewChatText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);

  // UI Panels (Mobile bottom sheet or Desktop drawer)
  const [activePanel, setActivePanel] = useState<'people' | 'chat' | 'info' | 'notes' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showInfoQr, setShowInfoQr] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [unreadChat, setUnreadChat] = useState(false);

  // Generate QR Code data URL whenever meetingId changes
  useEffect(() => {
    if (!meetingId) return;
    const fullUrl = getMeetingUrl(meetingId);
    QRCode.toDataURL(fullUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR data URL:', err));
  }, [meetingId]);
  const [isMinimizedPip, setIsMinimizedPip] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const notesEndRef = useRef<HTMLDivElement | null>(null);

  // Live Speech Recognition & Notes State
  const [meetingNotes, setMeetingNotes] = useState<{
    id: string;
    speaker: string;
    text: string;
    time: string;
    timestamp: number;
    isAutoTranscript?: boolean;
  }[]>([
    {
      id: 'welcome-note',
      speaker: 'JUMMP AI Notes',
      text: 'Live meeting notes and speech transcription active. Whichever user speaks, their words will be recognized here in real-time.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      isAutoTranscript: true,
    },
  ]);
  const [interimTranscript, setInterimTranscript] = useState<{ speaker: string; text: string } | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const [dominantSpeaker, setDominantSpeaker] = useState<string | null>(null);
  const dominantSpeakerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [newCustomNote, setNewCustomNote] = useState('');
  const recognitionRef = useRef<any>(null);
  const isStartingOrRunningRef = useRef(false);
  const isSpeakingBroadcastingRef = useRef(false);
  const latestMeetingStateRef = useRef({
    activePanel,
    participants,
    micEnabled,
    camEnabled,
    handRaised,
    isScreenSharing,
    isRecording,
  });
  latestMeetingStateRef.current = {
    activePanel,
    participants,
    micEnabled,
    camEnabled,
    handRaised,
    isScreenSharing,
    isRecording,
  };

  // Google Meet / Apple Floating Toast Notification
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    title: string;
    subtitle?: string;
    type?: 'chat' | 'user' | 'info';
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((title: string, subtitle?: string, type: 'chat' | 'user' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastNotification({ id: Date.now().toString(), title, subtitle, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
    }, 3800);
  }, []);

  // Mobile Bottom Sheet Gesture Tracking (Swipe down to dismiss)
  const sheetTouchStartY = useRef(0);
  const [sheetOffsetY, setSheetOffsetY] = useState(0);

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    sheetTouchStartY.current = e.touches[0].clientY;
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - sheetTouchStartY.current;
    if (deltaY > 0) {
      setSheetOffsetY(deltaY);
    }
  };

  const handleSheetTouchEnd = () => {
    if (sheetOffsetY > 65) {
      triggerHaptic('light');
      setActivePanel(null);
    }
    setSheetOffsetY(0);
  };

  const channelRef = useRef<MeetChannel | null>(null);
  const handleLeaveCallRef = useRef<() => void>(() => {});

  const sendHostEvent = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      if (!hostToken || !channelRef.current) return false;
      const response = await fetch('/api/meet/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: meetingId, hostToken, type, payload }),
      });
      const auth = await response.json();
      if (!response.ok || !auth.signature) return false;
      channelRef.current.send(type, {
        ...payload,
        _hostAuth: { issuedAt: auth.issuedAt, signature: auth.signature },
      });
      return true;
    },
    [meetingId, hostToken]
  );

  useEffect(() => {
    let cancelled = false;
    const resolveHost = async () => {
      const token = getHostCapability(meetingId);
      const valid = token ? await verifyHostCapability(meetingId, token).catch(() => false) : false;
      if (cancelled) return;
      setHostToken(valid ? token : null);
      setIsHost(valid);
      setHostResolved(true);
    };
    resolveHost();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // =========================================================================
  // 1. INITIALIZE STATUS & DATABASE RECORD (Handles Inactivity & Weeks-Old Links)
  // =========================================================================
  useEffect(() => {
    if (!hostResolved) return;
    let isMounted = true;

    async function initStatus() {
      setIsCheckingStatus(true);
      const check = await checkMeetingStatus(meetingId);
      if (!isMounted) return;
      setStatusCheck(check);
      setIsCheckingStatus(false);

      // Anonymous hosts create the database record. Guests can inspect it but never
      // create or reactivate a room merely by opening an invitation link.
      if (isHost && !check.isExpired && !check.isEnded) {
        const meeting = await createOrGetMeeting(meetingId, 'Host');
        if (meeting && isMounted) {
          setDbMeeting(meeting);
          const messages = await getMeetingMessages(meeting.id);
          if (messages && messages.length > 0 && isMounted) {
            setChatMessages(
              messages.map((m) => ({
                id: m.id,
                sender: m.sender_name,
                text: m.content,
                time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }))
            );
          }
        }
      } else if (check.meeting && isMounted) {
        setDbMeeting(check.meeting);
      }
    }

    initStatus();

    return () => {
      isMounted = false;
    };
  }, [meetingId, hostResolved, isHost]);

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    localScreenStreamRef.current = screenStream;
  }, [screenStream]);

  // =========================================================================
  // BACKEND HEARTBEAT & 10-MINUTE INACTIVITY SYNC (Robust Supabase API)
  // =========================================================================
  useEffect(() => {
    if (!inCall) return;
    const credential = isHost ? hostToken : admissionToken;
    if (!credential) return;

    const sendBackendHeartbeat = async (action: 'heartbeat' | 'leave' = 'heartbeat') => {
      try {
        const res = await fetch('/api/meet/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: meetingId,
            participantName: userName || (isHost ? 'Host' : 'Guest'),
            action,
            credential,
          }),
        });
        const data = await res.json();
        if (data.isInactiveEnded && !isHost) {
          showToast('Meeting Inactive', 'Room closed after 10 minutes of inactivity.', 'info');
        }
      } catch (error) {
        console.warn('Meeting heartbeat failed:', error);
      }
    };

    sendBackendHeartbeat('heartbeat');

    const interval = setInterval(() => {
      sendBackendHeartbeat('heartbeat');
    }, 20000);

    return () => {
      clearInterval(interval);
      sendBackendHeartbeat('leave');
    };
  }, [inCall, meetingId, userName, isHost, hostToken, admissionToken, showToast]);

  // =========================================================================
  // 10-MINUTE ALONE INACTIVITY WATCHDOG ("Are you still here?")
  // =========================================================================
  useEffect(() => {
    if (!inCall) {
      aloneSinceRef.current = null;
      setShowStillHereModal(false);
      return;
    }

    const myNormalized = (userName || (isHost ? 'Host' : '')).trim().toLowerCase();
    const otherParticipantsCount = participants.filter((p) => {
      const pNorm = (p.name || '').trim().toLowerCase();
      if (!pNorm || pNorm === myNormalized) return false;
      if (isHost && (p.isHost || pNorm === 'host')) return false;
      return true;
    }).length;

    if (otherParticipantsCount === 0) {
      if (!aloneSinceRef.current) {
        aloneSinceRef.current = Date.now();
      }
    } else {
      aloneSinceRef.current = null;
      setShowStillHereModal(false);
      return;
    }

    // Check every 8 seconds if 10 minutes (600,000 ms) have passed alone
    const watchdogInterval = setInterval(() => {
      if (aloneSinceRef.current && !showStillHereModal) {
        const elapsed = Date.now() - aloneSinceRef.current;
        if (elapsed >= 10 * 60 * 1000) {
          playChime('knock');
          triggerHaptic('heavy');
          setShowStillHereModal(true);
          setStillHereCountdown(60);
        }
      }
    }, 8000);

    return () => clearInterval(watchdogInterval);
  }, [inCall, participants, userName, isHost, showStillHereModal]);

  // Countdown timer when "Are you still here?" modal is shown
  useEffect(() => {
    if (!showStillHereModal) return;

    const timer = setInterval(() => {
      setStillHereCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleLeaveCallRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showStillHereModal]);

  const handleStayInMeeting = () => {
    triggerHaptic('medium');
    setShowStillHereModal(false);
    aloneSinceRef.current = Date.now();
    fetch('/api/meet/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: meetingId,
        participantName: userName || (isHost ? 'Host' : 'Guest'),
        action: 'keepalive',
        credential: isHost ? hostToken : admissionToken,
      }),
    }).catch(() => {});
    showToast('Meeting Active', 'You are still in the call. Inactivity timer reset.', 'info');
  };

  // =========================================================================
  // BROWSER-SIDE MEDIA RECORDER (Apple-Grade Client Video & Audio Recording)
  // =========================================================================
  const startBrowserRecording = async () => {
    if (!isHost) {
      showToast('Permission Denied', 'Only the meeting host can record this session', 'info');
      return;
    }

    try {
      // Capture display / tab with audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any,
        audio: true,
      });

      // Mix mic audio if active
      const audioTracks: MediaStreamTrack[] = [];
      const displayAudio = displayStream.getAudioTracks()[0];
      if (displayAudio) audioTracks.push(displayAudio);

      if (localStreamRef.current && micEnabled) {
        const micAudio = localStreamRef.current.getAudioTracks()[0];
        if (micAudio) audioTracks.push(micAudio);
      }

      let combinedStream: MediaStream;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (audioTracks.length > 1 && AudioContextClass) {
        try {
          const ctx = new AudioContextClass();
          const dest = ctx.createMediaStreamDestination();
          audioTracks.forEach((t) => {
            const trackStream = new MediaStream([t]);
            const source = ctx.createMediaStreamSource(trackStream);
            source.connect(dest);
          });
          combinedStream = new MediaStream([
            displayStream.getVideoTracks()[0],
            ...dest.stream.getAudioTracks(),
          ]);
        } catch {
          combinedStream = displayStream;
        }
      } else {
        combinedStream = displayStream;
      }

      recordingStreamRef.current = displayStream;
      recordingChunksRef.current = [];

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
      }

      const recorder = mimeType
        ? new MediaRecorder(combinedStream, { mimeType })
        : new MediaRecorder(combinedStream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setHasDownloadedRecording(false);
        setShowRecordingModal(true);
        setIsRecording(false);
        setIsPausedRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((t) => t.stop());
          recordingStreamRef.current = null;
        }

        // Notify everyone that recording stopped
        channelRef.current?.send('RECORDING_STATUS', {
          isRecording: false,
          recorderName: userName || 'Host',
        });
      };

      // Native browser pill stop trigger
      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPausedRecording(false);
      setRecordingSeconds(0);

      // Notify everyone in the meeting that host started recording
      channelRef.current?.send('RECORDING_STATUS', {
        isRecording: true,
        recorderName: userName || 'Host',
      });
      showToast('Recording Started', 'You are recording this session. All participants are notified.', 'info');

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err) {
      console.warn('Browser recording cancelled or failed:', err);
    }
  };

  const pauseBrowserRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPausedRecording(true);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const resumeBrowserRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPausedRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    }
  };

  const stopBrowserRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadRecording = () => {
    if (!recordedUrl) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `JUMMP-Recording-${meetingId}-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setHasDownloadedRecording(true);
    showToast('Download Started', 'Recording saved directly to your device storage.', 'info');
  };

  const handleCloseRecordingModal = () => {
    if (!hasDownloadedRecording) {
      const confirmDiscard = window.confirm(
        'Warning: You have not downloaded this recording yet!\n\nRecordings are NEVER stored in the database or on the server. If you close this window now, this recording will be permanently deleted and will no longer be available.\n\nAre you sure you want to discard it?'
      );
      if (!confirmDiscard) return;
    }
    setShowRecordingModal(false);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    recordingChunksRef.current = [];
    setHasDownloadedRecording(false);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // =========================================================================
  // 3. AUDIO VISUALIZER (Real-time voice activity detection)
  // =========================================================================
  useEffect(() => {
    if (!localStream || !micEnabled) {
      setAudioVolume(0);
      return;
    }

    const cleanup = createAudioVisualizer(localStream, (vol) => {
      setAudioVolume(vol);
    });

    return () => cleanup();
  }, [localStream, micEnabled]);

  // =========================================================================
  // 4. ACQUIRE LOCAL MEDIA (Camera & Mic)
  // =========================================================================
  const acquireMedia = useCallback(
    async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camEnabled
            ? {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
          audio: micEnabled ? { echoCancellation: true, noiseSuppression: true } : false,
        });

        const previousStream = localStreamRef.current;
        if (previousStream && previousStream !== stream) {
          previousStream.getTracks().forEach((track) => track.stop());
        }
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Attach to lobby preview video if present
        if (localVideoRef.current) {
          localVideoRef.current.defaultMuted = true;
          localVideoRef.current.muted = true;
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        // Attach to in-call video if present
        if (inCallVideoRef.current) {
          inCallVideoRef.current.defaultMuted = true;
          inCallVideoRef.current.muted = true;
          inCallVideoRef.current.srcObject = stream;
          inCallVideoRef.current.play().catch(() => {});
        }
        // Attach to any mounted self-video elements immediately
        document.querySelectorAll('video[data-self-video="true"]').forEach((vid) => {
          const v = vid as HTMLVideoElement;
          v.defaultMuted = true;
          v.muted = true;
          if (v.srcObject !== stream) {
            v.srcObject = stream;
          }
          v.play().catch(() => {});
        });

        // Re-publish to LiveKit if connected
        if (livekitRoomRef.current) {
          const participant = livekitRoomRef.current.localParticipant;
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          const existingVideo = participant.getTrackPublication(Track.Source.Camera)?.track;
          const existingAudio = participant.getTrackPublication(Track.Source.Microphone)?.track;
          if (existingVideo) await participant.unpublishTrack(existingVideo);
          if (existingAudio) await participant.unpublishTrack(existingAudio);
          if (videoTrack) {
            await participant.publishTrack(videoTrack, { source: Track.Source.Camera });
          }
          if (audioTrack) {
            await participant.publishTrack(audioTrack, { source: Track.Source.Microphone });
          }
        }

        return stream;
      } catch (err) {
        console.warn('getUserMedia error:', err);
        return null;
      }
    },
    [camEnabled, micEnabled]
  );

  // Reliable callback ref for mounting local video feeds with 0ms autoplay
  const bindLocalVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;
      inCallVideoRef.current = el;
      el.defaultMuted = true;
      el.muted = true;
      const stream = localStreamRef.current || localStream;
      if (stream) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
        el.play().catch(() => {});
      }
    },
    [localStream]
  );

  // Initialize camera & mic in Lobby
  useEffect(() => {
    if (!inCall && !hasLeft && !statusCheck?.isExpired) {
      acquireMedia();
    }
  }, [acquireMedia, inCall, hasLeft, statusCheck?.isExpired]);

  // Synchronize local video stream to self-view elements immediately on mount or view changes
  useEffect(() => {
    if (inCall && camEnabled) {
      const stream = localStreamRef.current || localStream;
      if (stream) {
        const attach = () => {
          document.querySelectorAll('video[data-self-video="true"]').forEach((vid) => {
            const v = vid as HTMLVideoElement;
            v.defaultMuted = true;
            v.muted = true;
            if (v.srcObject !== stream) {
              v.srcObject = stream;
            }
            v.play().catch(() => {});
          });
        };
        attach();
        const t1 = setTimeout(attach, 50);
        const t2 = setTimeout(attach, 200);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      } else {
        acquireMedia();
      }
    }
  }, [inCall, camEnabled, localStream, participants.length, acquireMedia]);

  // Clean up media streams and release hardware when user leaves meeting or unmounts
  useEffect(() => {
    if (hasLeft) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
      }
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        localScreenStreamRef.current = null;
        setScreenStream(null);
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
      }
    }
  }, [hasLeft, localStream, screenStream]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
        localScreenStreamRef.current = null;
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // =========================================================================
  // 5. RESILIENT MOBILE APP-SWITCHING / BACKGROUND FREEZE RECOVERY ENGINE
  // (Fixes: "I opened another app and came back it got stucked")
  // =========================================================================
  useEffect(() => {
    const handleForegroundReturn = async () => {
      // Triggered when user returns from WhatsApp/Instagram/Camera/Screen-lock
      if (document.visibilityState === 'visible') {
        // 1. Force unpause and kickstart all video elements (Safari & Chrome mobile freeze or pause them in background)
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach((video) => {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              if (e.name === 'NotAllowedError') {
                setAutoplayBlocked(true);
              }
            });
          }
        });

        // 2. Re-bind local streams if video elements got unlinked
        if (localStreamRef.current) {
          if (inCallVideoRef.current && inCallVideoRef.current.srcObject !== localStreamRef.current) {
            inCallVideoRef.current.srcObject = localStreamRef.current;
            inCallVideoRef.current.play().catch(() => {});
          }
          if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.play().catch(() => {});
          }
        }

        // 3. Check if local camera/mic tracks were revoked or ended by OS
        const currentTracks = localStreamRef.current?.getTracks() || [];
        const hasDeadTrack =
          currentTracks.length === 0 ||
          currentTracks.some((t) => t.readyState === 'ended');

        if (hasDeadTrack && (camEnabled || micEnabled)) {
          console.log('Re-acquiring dead media tracks after background return...');
          try {
            const freshStream = await acquireMedia();
            if (freshStream) {
              if (inCallVideoRef.current) {
                inCallVideoRef.current.srcObject = freshStream;
                inCallVideoRef.current.play().catch(() => {});
              }
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = freshStream;
                localVideoRef.current.play().catch(() => {});
              }

              // Update WebRTC peer tracks if in P2P mode
              Object.entries(peerConnectionsRef.current).forEach(([peerName, pc]) => {
                freshStream.getTracks().forEach((track) => {
                  const sender = pc.getSenders().find(
                    (candidate) =>
                      candidate.track?.kind === track.kind &&
                      candidate !== screenSendersRef.current[peerName] &&
                      candidate !== screenAudioSendersRef.current[peerName]
                  );
                  if (sender) {
                    sender.replaceTrack(track).catch(() => {});
                  } else {
                    pc.addTrack(track, freshStream);
                  }
                });
              });
            }
          } catch (e) {
            console.warn('Media re-acquisition failed:', e);
          }
        }

        // 4. WebRTC ICE Self-Healing: Reconnect any peer connections broken by background sleep
        if (transportMode !== 'livekit') Object.entries(peerConnectionsRef.current).forEach(async ([peerName, pc]) => {
          const isBadState =
            pc.iceConnectionState === 'disconnected' ||
            pc.iceConnectionState === 'failed' ||
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'failed';

          if (isBadState) {
            console.log(`[WebRTC] Healing degraded connection to ${peerName}...`);
            try {
              if (pc.restartIce) pc.restartIce();
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              channelRef.current?.send('WEBRTC_SIGNAL', {
                from: userName || (isHost ? 'Host' : 'Guest'),
                to: peerName,
                type: 'offer',
                sdp: offer,
              });
            } catch (err) {
              console.warn('ICE recovery offer failed:', err);
            }
          }
        });

        // 5. LiveKit SFU Reconnection Check
        if (livekitRoomRef.current) {
          const room = livekitRoomRef.current;
          if (room.state === 'disconnected') {
            console.log('LiveKit room disconnected during background. Triggering reconnection...');
            try {
              const name = userName || (isHost ? 'Host' : 'Guest');
              const credential = isHost ? hostToken : admissionToken;
              if (!credential) return;
              const res = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room: meetingId, username: name, credential }),
              });
              const data = await res.json();
              if (data.configured && data.token && data.url) {
                await room.connect(data.url, data.token);
              }
            } catch (e) {
              console.warn('LiveKit reconnect error:', e);
            }
          }
        }

        // 6. Broadcast RESYNC ping to notify peers we are back
        if (channelRef.current && inCall) {
          channelRef.current.send('PEER_RESYNC', {
            name: userName || (isHost ? 'Host' : 'Guest'),
            timestamp: Date.now(),
          });
        }

        // 7. Check if 10-minute alone watchdog expired while tab was hidden
        if (inCall && aloneSinceRef.current && !showStillHereModal) {
          const elapsed = Date.now() - aloneSinceRef.current;
          if (elapsed >= 10 * 60 * 1000) {
            playChime('knock');
            triggerHaptic('heavy');
            setShowStillHereModal(true);
            setStillHereCountdown(60);
          }
        }

        setTimeout(() => {
          setIsResyncing(false);
        }, 1200);
      }
    };

    document.addEventListener('visibilitychange', handleForegroundReturn);
    window.addEventListener('pageshow', handleForegroundReturn);

    return () => {
      document.removeEventListener('visibilitychange', handleForegroundReturn);
      window.removeEventListener('pageshow', handleForegroundReturn);
    };
  }, [acquireMedia, camEnabled, micEnabled, inCall, userName, isHost, meetingId, hostToken, admissionToken, showStillHereModal, transportMode]);

  // One-tap resume if browser blocked autoplay upon returning
  const handleUserGestureResume = () => {
    setAutoplayBlocked(false);
    document.querySelectorAll('video').forEach((v) => {
      v.play().catch(() => {});
    });
    acquireMedia();
  };

  // =========================================================================
  // 6. LIVEKIT SFU INTEGRATION
  // =========================================================================
  useEffect(() => {
    if (!inCall) return;

    let isCleanedUp = false;

    async function connectLiveKit() {
      try {
        const name = userName || (isHost ? 'Host' : 'Guest');
        const credential = isHost ? hostToken : admissionToken;
        if (!credential) return;
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: meetingId, username: name, credential }),
        });
        const data = await res.json();
        if (isCleanedUp) return;

        if (data.configured && data.token && data.url) {
          setTransportMode('livekit');
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });
          livekitRoomRef.current = room;

          room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant: RemoteParticipant) => {
            const displayName = participant.name || participant.identity;
            if (track.kind === Track.Kind.Video) {
              const stream = new MediaStream([track.mediaStreamTrack]);
              if ((pub as any).source === Track.Source.ScreenShare) {
                remoteScreenStreamRef.current = stream;
                setRemoteScreenStream(stream);
                setActiveScreenSharer(displayName);
                activeScreenSharerRef.current = displayName;
              } else {
                remoteStreamsRef.current[displayName] = stream;
                setRemoteStreams((prev) => ({
                  ...prev,
                  [displayName]: stream,
                }));
              }
            } else if (track.kind === Track.Kind.Audio) {
              const audioEl = track.attach();
              audioEl.id = `livekit-audio-${participant.identity}`;
              document.body.appendChild(audioEl);
            }
          });

          room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio) {
              track.detach().forEach((el) => el.remove());
            }
          });

          room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            const displayName = (participant.name || participant.identity || '').trim();
            const normalizedDisplay = displayName.toLowerCase();
            const normalizedLocal = (userName || (isHost ? 'Host' : '')).trim().toLowerCase();

            // CRITICAL: Never add the local user as a remote participant!
            if (!normalizedDisplay || normalizedDisplay === normalizedLocal) return;

            setParticipants((prev) => {
              // Deduplicate by normalized name or participant identity
              const existingIdx = prev.findIndex(
                (p) =>
                  p.id === participant.identity ||
                  p.name.trim().toLowerCase() === normalizedDisplay
              );

              if (existingIdx !== -1) {
                // Update existing participant in-place without duplicating
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  id: participant.identity,
                  name: displayName || updated[existingIdx].name,
                  isHost: updated[existingIdx].isHost || normalizedDisplay === 'host' || normalizedDisplay.includes('host'),
                };
                return updated;
              }

              return [
                ...prev,
                {
                  id: participant.identity,
                  name: displayName,
                  isHost: normalizedDisplay === 'host' || normalizedDisplay.includes('host'),
                  audioEnabled: true,
                  videoEnabled: true,
                  handRaised: false,
                  isScreenSharing: false,
                  joinedAt: Date.now(),
                },
              ];
            });
          });

          room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            const displayName = (participant.name || participant.identity || '').trim();
            const normalizedDisplay = displayName.toLowerCase();

            setRemoteStreams((prev) => {
              const next = { ...prev };
              Object.keys(next).forEach((k) => {
                if (k.trim().toLowerCase() === normalizedDisplay || k === displayName) {
                  delete next[k];
                }
              });
              return next;
            });
            delete remoteStreamsRef.current[displayName];
            Object.keys(remoteStreamsRef.current).forEach((k) => {
              if (k.trim().toLowerCase() === normalizedDisplay) {
                delete remoteStreamsRef.current[k];
              }
            });

            // Remove by BOTH identity and normalized name so they never linger as ghost tiles
            setParticipants((prev) =>
              prev.filter(
                (p) =>
                  p.id !== participant.identity &&
                  p.name.trim().toLowerCase() !== normalizedDisplay
              )
            );
            const audioEl = document.getElementById(`livekit-audio-${participant.identity}`);
            if (audioEl) audioEl.remove();
          });

          room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const speakingNames = new Set<string>();
            speakers.forEach((s) => {
              const sName = (s.name || s.identity || '').trim().toLowerCase();
              if (sName) speakingNames.add(sName);
            });
            setActiveSpeakers(speakingNames);
          });

          await room.connect(data.url, data.token);

          // Synchronize any participants already in the room upon connection
          room.remoteParticipants.forEach((participant) => {
            const displayName = (participant.name || participant.identity || '').trim();
            const normalizedDisplay = displayName.toLowerCase();
            const normalizedLocal = (userName || (isHost ? 'Host' : '')).trim().toLowerCase();
            if (!normalizedDisplay || normalizedDisplay === normalizedLocal) return;

            setParticipants((prev) => {
              const existingIdx = prev.findIndex(
                (p) =>
                  p.id === participant.identity ||
                  p.name.trim().toLowerCase() === normalizedDisplay
              );
              if (existingIdx !== -1) {
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  id: participant.identity,
                  name: displayName || updated[existingIdx].name,
                  isHost: updated[existingIdx].isHost || normalizedDisplay === 'host' || normalizedDisplay.includes('host'),
                };
                return updated;
              }
              return [
                ...prev,
                {
                  id: participant.identity,
                  name: displayName,
                  isHost: normalizedDisplay === 'host' || normalizedDisplay.includes('host'),
                  audioEnabled: true,
                  videoEnabled: true,
                  handRaised: false,
                  isScreenSharing: false,
                  joinedAt: Date.now(),
                },
              ];
            });
          });

          if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (videoTrack) {
              await room.localParticipant.publishTrack(videoTrack, { source: Track.Source.Camera });
            }
            if (audioTrack) {
              await room.localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
            }
          }
        } else {
          setTransportMode('p2p');
        }
      } catch (e) {
        console.warn('LiveKit SFU initialization fallback to P2P WebRTC:', e);
        if (!isCleanedUp) setTransportMode('p2p');
      }
    }

    connectLiveKit();

    return () => {
      isCleanedUp = true;
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
    };
  }, [inCall, meetingId, userName, isHost, hostToken, admissionToken]);

  // Update in-call video ref when inCall state changes
  useEffect(() => {
    if (inCall && localStream && inCallVideoRef.current) {
      inCallVideoRef.current.srcObject = localStream;
      inCallVideoRef.current.play().catch(() => {});
    }
  }, [inCall, localStream]);

  // Update screen share video ref reliably when screenStream or isScreenSharing changes
  useEffect(() => {
    if (screenShareVideoRef.current && screenStream) {
      screenShareVideoRef.current.srcObject = screenStream;
      screenShareVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isScreenSharing]);

  // Update remote screen share video ref reliably when remoteScreenStream changes
  useEffect(() => {
    const video = remoteScreenVideoRef.current;
    if (video && remoteScreenStream) {
      video.defaultMuted = true;
      video.muted = true;
      if (video.srcObject !== remoteScreenStream) {
        video.srcObject = remoteScreenStream;
      }
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[Screen] Autoplay retry:', err);
          video.defaultMuted = true;
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    }
  }, [remoteScreenStream, activeScreenSharer]);

  // Auto-scroll chat panel to latest message
  useEffect(() => {
    if (activePanel === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activePanel]);

  // =========================================================================
  // 7. WEBRTC P2P FALLBACK (Zero-config peer mesh)
  // =========================================================================
  const createPeerConnection = useCallback((targetName: string) => {
    if (peerConnectionsRef.current[targetName]) {
      return peerConnectionsRef.current[targetName];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const hasSender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (!hasSender) {
          pc.addTrack(track, localStreamRef.current!);
        }
      });
    }

    // Attach active screen share track if currently presenting
    const activeLocalScreen = localScreenStreamRef.current;
    if (activeLocalScreen) {
      const screenTrack = activeLocalScreen.getVideoTracks()[0];
      if (screenTrack) {
        const sender = pc.addTrack(screenTrack, activeLocalScreen);
        screenSendersRef.current[targetName] = sender;
      }
      const screenAudioTrack = activeLocalScreen.getAudioTracks()[0];
      if (screenAudioTrack) {
        screenAudioSendersRef.current[targetName] = pc.addTrack(screenAudioTrack, activeLocalScreen);
      }
    }

    pc.ontrack = (event) => {
      const incomingTrack = event.track;
      const incomingStream = event.streams[0] || new MediaStream([incomingTrack]);
      console.log(`[WebRTC] Received ${incomingTrack.kind} track from ${targetName}`);

      // Handle track mute/unmute to prevent frozen frames & auto-resume playback
      incomingTrack.onmute = () => {
        console.log(`[WebRTC] Track muted from ${targetName}: ${incomingTrack.kind}`);
        if (incomingTrack.kind === 'video') {
          setParticipants((prev) =>
            prev.map((p) => (p.name === targetName ? { ...p, videoEnabled: false } : p))
          );
        }
      };

      incomingTrack.onunmute = () => {
        console.log(`[WebRTC] Track unmuted from ${targetName}: ${incomingTrack.kind}`);
        if (incomingTrack.kind === 'video') {
          setParticipants((prev) =>
            prev.map((p) => (p.name === targetName ? { ...p, videoEnabled: true } : p))
          );
          setTimeout(() => {
            document.querySelectorAll('video').forEach((v) => {
              v.play().catch(() => {});
            });
          }, 100);
        }
      };

      const isCurrentSharer = activeScreenSharerRef.current === targetName;
      const alreadyHasWebcam = Boolean(remoteWebcamTracksRef.current[targetName]);

      let isScreen = false;
      if (incomingTrack.kind === 'video') {
        if (remoteScreenTrackIdRef.current && incomingTrack.id === remoteScreenTrackIdRef.current) {
          isScreen = true;
        } else if (remoteScreenStreamIdRef.current && incomingStream.id === remoteScreenStreamIdRef.current) {
          isScreen = true;
        } else if ((incomingTrack as any).contentHint === 'detail') {
          isScreen = true;
        } else if (isCurrentSharer && alreadyHasWebcam && remoteWebcamTracksRef.current[targetName].id !== incomingTrack.id) {
          isScreen = true;
        }
      }

      if (isScreen) {
        console.log('[WebRTC] Identified as screen share stream from', targetName);
        const screenStreamObj = new MediaStream([incomingTrack]);
        const incomingAudio = incomingStream.getAudioTracks()[0];
        if (incomingAudio) screenStreamObj.addTrack(incomingAudio);

        remoteScreenStreamRef.current = screenStreamObj;
        setRemoteScreenStream(screenStreamObj);
        setActiveScreenSharer(targetName);
        activeScreenSharerRef.current = targetName;
      } else {
        if (incomingTrack.kind === 'video') {
          remoteWebcamTracksRef.current[targetName] = incomingTrack;
        }
        remoteStreamsRef.current[targetName] = incomingStream;
        setRemoteStreams((prev) => ({
          ...prev,
          [targetName]: incomingStream,
        }));
      }

      // Auto-ensure targetName is in participants list so video tile renders immediately!
      const targetNormalized = (targetName || '').trim().toLowerCase();
      const myNormalized = (userName || (isHost ? 'Host' : 'Guest')).trim().toLowerCase();
      if (targetNormalized && targetNormalized !== myNormalized) {
        setParticipants((prev) => {
          if (prev.some((p) => (p.name || '').trim().toLowerCase() === targetNormalized)) return prev;
          return [
            ...prev,
            {
              id: 'peer-' + targetName.trim(),
              name: targetName.trim(),
              isHost: targetNormalized === 'host' || targetNormalized.includes('host'),
              audioEnabled: true,
              videoEnabled: incomingTrack.kind === 'video' ? !incomingTrack.muted : true,
              handRaised: false,
              isScreenSharing: false,
              joinedAt: Date.now(),
            },
          ];
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send('WEBRTC_SIGNAL', {
          from: userName || (isHost ? 'Host' : 'Guest'),
          to: targetName,
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    // Auto-healing for background app-switching and stale ICE
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${targetName}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (pc.restartIce) {
          pc.restartIce();
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetName}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        if (pc.restartIce) {
          pc.restartIce();
        }
      }
    };

    (pc as any)._targetPeer = targetName;
    peerConnectionsRef.current[targetName] = pc;
    return pc;
  }, [isHost, userName]);

  // =========================================================================
  // 8. REAL-TIME SIGNALING CHANNEL (Supabase WebSockets + BroadcastChannel)
  // =========================================================================
  useEffect(() => {
    const handleChannelMessage = async (msg: any) => {
      if (!msg || msg.meetingId !== meetingId) return;

      const hostOnlyEvents = new Set([
        'HOST_PONG',
        'HOST_ARRIVED',
        'ADMIT_GUEST',
        'DENY_GUEST',
        'MUTE_PARTICIPANT_AUDIO',
        'MUTE_ALL_AUDIO',
        'STOP_PARTICIPANT_VIDEO',
        'STOP_ALL_VIDEO',
      ]);
      if (hostOnlyEvents.has(msg.type)) {
        const { _hostAuth, ...trustedPayload } = msg.payload || {};
        if (!_hostAuth?.signature || typeof _hostAuth?.issuedAt !== 'number') return;
        const verification = await fetch('/api/meet/event', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: meetingId,
            type: msg.type,
            payload: trustedPayload,
            issuedAt: _hostAuth.issuedAt,
            signature: _hostAuth.signature,
          }),
        });
        if (!verification.ok) return;
        msg = { ...msg, payload: trustedPayload };
      }

      if (msg.type === 'PING_HOST') {
        if (isHost && inCall) {
          void sendHostEvent('HOST_PONG', { hostName: userName || 'Host' });
        }
      } else if (msg.type === 'HOST_PONG' || msg.type === 'HOST_ARRIVED') {
        setHostInMeeting(true);
      } else if (msg.type === 'REQUEST_JOIN') {
        if (isHost) {
          playChime('knock');
          setPendingRequests((prev) => [
            ...prev.filter((r) => r.id !== msg.payload.id),
            msg.payload,
          ]);
        }
      } else if (msg.type === 'ADMIT_GUEST') {
        if (msg.payload.guestId === participantId && typeof msg.payload.admissionToken === 'string') {
          playChime('admit');
          setAdmissionToken(msg.payload.admissionToken);
          setWaitingToJoin(false);
          setInCall(true);

          const myParticipant: Participant = {
            id: participantId,
            name: userName || 'Guest',
            isHost: false,
            audioEnabled: latestMeetingStateRef.current.micEnabled,
            videoEnabled: latestMeetingStateRef.current.camEnabled,
            handRaised: false,
            isScreenSharing: false,
            joinedAt: Date.now(),
          };

          // Populate participants roster cleanly from host's list (never duplicate host or self)
          const myNormalized = myParticipant.name.trim().toLowerCase();
          const initialMap = new Map<string, Participant>();

          if (Array.isArray(msg.payload.existingParticipants)) {
            msg.payload.existingParticipants.forEach((p: Participant) => {
              const k = p.name.trim().toLowerCase();
              if (k !== myNormalized) {
                initialMap.set(k, p);
              }
            });
          }

          if (msg.payload.hostName) {
            const hostNormalized = msg.payload.hostName.trim().toLowerCase();
            if (hostNormalized !== myNormalized) {
              const existingHost = initialMap.get(hostNormalized);
              initialMap.set(hostNormalized, {
                id: existingHost?.id || 'host-user',
                name: msg.payload.hostName,
                isHost: true,
                audioEnabled: existingHost?.audioEnabled ?? true,
                videoEnabled: existingHost?.videoEnabled ?? true,
                handRaised: existingHost?.handRaised ?? false,
                isScreenSharing: existingHost?.isScreenSharing ?? false,
                joinedAt: existingHost?.joinedAt ?? Date.now(),
              });
            }
          }

          // Only keep remote participants in participants state
          setParticipants(Array.from(initialMap.values()));

          // Broadcast USER_JOINED so existing participants connect WebRTC to us
          channelRef.current?.send('USER_JOINED', myParticipant);
        }
      } else if (msg.type === 'DENY_GUEST') {
        if (msg.payload.guestId === participantId) {
          setWaitingToJoin(false);
          setDenied(true);
        }
      } else if (msg.type === 'CHAT_MESSAGE') {
        setChatMessages((prev) => [...prev, msg.payload]);
        playChime('chat');
        if (latestMeetingStateRef.current.activePanel !== 'chat') {
          setUnreadChat(true);
          showToast(msg.payload.sender, msg.payload.text, 'chat');
        }
      } else if (msg.type === 'REACTION') {
        triggerReaction(msg.payload.emoji, false);
      } else if (msg.type === 'SCREEN_SHARE_STARTED') {
        const sharer = msg.payload?.sharerName;
        setActiveScreenSharer(sharer);
        activeScreenSharerRef.current = sharer;
        remoteScreenTrackIdRef.current = msg.payload?.trackId || null;
        remoteScreenStreamIdRef.current = msg.payload?.streamId || null;

        // If another person starts presenting while we are presenting, stop ours
        if (localScreenStreamRef.current && sharer !== (userName || (isHost ? 'Host' : 'Guest'))) {
          if (localScreenStreamRef.current) {
            localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
          }
          localScreenStreamRef.current = null;
          setScreenStream(null);
          setIsScreenSharing(false);
        }
      } else if (msg.type === 'SCREEN_SHARE_STOPPED') {
        setActiveScreenSharer(null);
        activeScreenSharerRef.current = null;
        setRemoteScreenStream(null);
        remoteScreenStreamRef.current = null;
        remoteScreenTrackIdRef.current = null;
        remoteScreenStreamIdRef.current = null;
      } else if (msg.type === 'USER_JOINED') {
        playChime('admit');
        const joinedP = msg.payload;
        const myName = (userName || (isHost ? 'Host' : 'Guest')).trim();
        const myNormalized = myName.toLowerCase();
        const joinedName = (joinedP?.name || '').trim();
        const joinedNormalized = joinedName.toLowerCase();

        // Strictly ignore if this event is for ourselves (no duplicate self tiles!)
        if (!joinedNormalized || joinedNormalized === myNormalized) return;

        setParticipants((prev) => {
          const filtered = prev.filter(
            (p) =>
              (p.name || '').trim().toLowerCase() !== joinedNormalized &&
              p.id !== joinedP.id
          );
          return [...filtered, { ...joinedP, name: joinedName }];
        });
        showToast('Participant Joined', `${joinedName} entered the call`, 'user');

        if (inCall) {
          // Send room roster so the newcomer definitely has all users without duplicates
          const rosterParticipants = latestMeetingStateRef.current.participants
            .filter((p) => {
              const pNorm = (p.name || '').trim().toLowerCase();
              return pNorm !== joinedNormalized && pNorm !== myNormalized;
            });

          channelRef.current?.send('ROOM_ROSTER', {
            to: joinedName,
            participants: [
              ...rosterParticipants,
              {
                id: isHost ? 'host-user' : ('self-' + myName),
                name: myName,
                isHost,
                audioEnabled: latestMeetingStateRef.current.micEnabled,
                videoEnabled: latestMeetingStateRef.current.camEnabled,
                handRaised: latestMeetingStateRef.current.handRaised,
                isScreenSharing: latestMeetingStateRef.current.isScreenSharing,
                joinedAt: Date.now(),
              },
            ],
          });

          // If we are currently sharing screen, send SCREEN_SHARE_STARTED to new user
          const activeLocalScreen = localScreenStreamRef.current;
          if (activeLocalScreen) {
            const screenTrack = activeLocalScreen.getVideoTracks()[0];
            channelRef.current?.send('SCREEN_SHARE_STARTED', {
              sharerName: myName,
              streamId: activeLocalScreen.id,
              trackId: screenTrack?.id,
            });
          }

          // If we are currently recording, sync RECORDING_STATUS to new user
          if (latestMeetingStateRef.current.isRecording) {
            channelRef.current?.send('RECORDING_STATUS', {
              isRecording: true,
              recorderName: myName,
            });
          }

          if (transportMode !== 'livekit') try {
            const pc = createPeerConnection(joinedName);
            // Ensure camera/mic tracks are attached
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                const hasSender = pc.getSenders().find((s) => s.track?.kind === track.kind);
                if (!hasSender) {
                  pc.addTrack(track, localStreamRef.current!);
                }
              });
            }
            // Ensure screen track is attached if screen sharing
            if (activeLocalScreen) {
              const screenTrack = activeLocalScreen.getVideoTracks()[0];
              if (screenTrack) {
                const sender = pc.addTrack(screenTrack, activeLocalScreen);
                screenSendersRef.current[joinedName] = sender;
              }
              const screenAudioTrack = activeLocalScreen.getAudioTracks()[0];
              if (screenAudioTrack) {
                screenAudioSendersRef.current[joinedName] = pc.addTrack(
                  screenAudioTrack,
                  activeLocalScreen
                );
              }
            }

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: myName,
              to: joinedName,
              type: 'offer',
              sdp: offer,
            });
          } catch (e) {
            console.log('WebRTC offer error:', e);
          }
        }
      } else if (msg.type === 'ROOM_ROSTER') {
        const myName = (userName || (isHost ? 'Host' : 'Guest')).trim();
        const myNormalized = myName.toLowerCase();
        const targetTo = (msg.payload?.to || '').trim().toLowerCase();

        if (targetTo === myNormalized && Array.isArray(msg.payload.participants)) {
          setParticipants((prev) => {
            const map = new Map<string, Participant>();
            // Add existing remote participants (excluding ourselves)
            prev.forEach((p) => {
              const k = (p.name || '').trim().toLowerCase();
              if (k && k !== myNormalized) {
                map.set(k, p);
              }
            });
            // Merge incoming participants (excluding ourselves)
            msg.payload.participants.forEach((p: Participant) => {
              const k = (p.name || '').trim().toLowerCase();
              if (k && k !== myNormalized) {
                const existing = map.get(k);
                map.set(k, {
                  ...p,
                  id: existing?.id || p.id,
                  name: p.name.trim(),
                  isHost: Boolean(existing?.isHost || p.isHost || k === 'host'),
                });
              }
            });
            return Array.from(map.values());
          });
        }
      } else if (msg.type === 'USER_LEFT') {
        playChime('leave');
        const leavingName = (msg.payload?.name || '').trim();
        const leavingNormalized = leavingName.toLowerCase();
        const leavingId = msg.payload?.id;

        setParticipants((prev) =>
          prev.filter((p) => {
            const pNorm = (p.name || '').trim().toLowerCase();
            if (leavingNormalized && pNorm === leavingNormalized) return false;
            if (leavingId && p.id === leavingId) return false;
            return true;
          })
        );
        showToast('Participant Left', `${leavingName || 'A participant'} left the room`, 'user');

        // Cleanup WebRTC peers
        Object.keys(peerConnectionsRef.current).forEach((k) => {
          if (k.trim().toLowerCase() === leavingNormalized || (leavingName && k === leavingName)) {
            try {
              peerConnectionsRef.current[k]?.close();
            } catch {}
            delete peerConnectionsRef.current[k];
          }
        });
        delete screenSendersRef.current[leavingName];
        delete screenAudioSendersRef.current[leavingName];
        delete pendingCandidatesRef.current[leavingName];

        // Clean up remoteStreams
        setRemoteStreams((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (k.trim().toLowerCase() === leavingNormalized || (leavingName && k === leavingName)) {
              delete next[k];
            }
          });
          return next;
        });

        // Clean up remoteStreamsRef
        delete remoteStreamsRef.current[leavingName];
        Object.keys(remoteStreamsRef.current).forEach((k) => {
          if (k.trim().toLowerCase() === leavingNormalized) {
            delete remoteStreamsRef.current[k];
          }
        });
      } else if (msg.type === 'MUTE_PARTICIPANT_AUDIO') {
        const myName = userName || (isHost ? 'Host' : 'Guest');
        if (msg.payload?.targetName === myName) {
          setMicEnabled(false);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
            });
          }
          if (livekitRoomRef.current) {
            livekitRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          }
          showToast('Microphone Muted', `You were muted by ${msg.payload?.byHost || 'the host'}`, 'info');
          playChime('knock');
        }
        if (msg.payload?.targetName) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.name === msg.payload.targetName ? { ...p, audioEnabled: false } : p
            )
          );
        }
      } else if (msg.type === 'MUTE_ALL_AUDIO') {
        if (!isHost) {
          setMicEnabled(false);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => {
              t.enabled = false;
            });
          }
          if (livekitRoomRef.current) {
            livekitRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          }
          showToast('Microphone Muted', 'The host muted all participants', 'info');
          playChime('knock');
        }
        setParticipants((prev) =>
          prev.map((p) => (!p.isHost ? { ...p, audioEnabled: false } : p))
        );
      } else if (msg.type === 'STOP_PARTICIPANT_VIDEO') {
        const myName = userName || (isHost ? 'Host' : 'Guest');
        if (msg.payload?.targetName === myName) {
          setCamEnabled(false);
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((t) => {
              t.enabled = false;
            });
          }
          if (livekitRoomRef.current) {
            livekitRoomRef.current.localParticipant.setCameraEnabled(false).catch(() => {});
          }
          showToast('Camera Turned Off', `Your video was stopped by ${msg.payload?.byHost || 'the host'}`, 'info');
          playChime('knock');
        }
        if (msg.payload?.targetName) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.name === msg.payload.targetName ? { ...p, videoEnabled: false } : p
            )
          );
        }
      } else if (msg.type === 'STOP_ALL_VIDEO') {
        if (!isHost) {
          setCamEnabled(false);
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((t) => {
              t.enabled = false;
            });
          }
          if (livekitRoomRef.current) {
            livekitRoomRef.current.localParticipant.setCameraEnabled(false).catch(() => {});
          }
          showToast('Camera Turned Off', 'The host stopped all video cameras', 'info');
          playChime('knock');
        }
        setParticipants((prev) =>
          prev.map((p) => (!p.isHost ? { ...p, videoEnabled: false } : p))
        );
      } else if (msg.type === 'MEDIA_STATE_UPDATE') {
        const { participantName, audioEnabled, videoEnabled } = msg.payload || {};
        if (participantName) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.name === participantName
                ? {
                    ...p,
                    ...(typeof audioEnabled === 'boolean' ? { audioEnabled } : {}),
                    ...(typeof videoEnabled === 'boolean' ? { videoEnabled } : {}),
                  }
                : p
            )
          );
          if (videoEnabled) {
            setTimeout(() => {
              document.querySelectorAll('video').forEach((v) => {
                v.play().catch(() => {});
              });
            }, 100);
          }
        }
      } else if (msg.type === 'HAND_RAISE') {
        const { name, handRaised: isRaised } = msg.payload || {};
        if (name) {
          setParticipants((prev) =>
            prev.map((p) => (p.name === name ? { ...p, handRaised: isRaised } : p))
          );
          const myName = userName || (isHost ? 'Host' : 'Guest');
          if (isRaised && name !== myName) {
            playChime('knock');
            showToast('Hand Raised', `${name} raised their hand`, 'user');
          }
        }
      } else if (msg.type === 'RECORDING_STATUS') {
        const { isRecording: recActive, recorderName } = msg.payload || {};
        setIsRoomRecording(Boolean(recActive));
        setRecordingBy(recorderName || 'Host');
        const myName = userName || (isHost ? 'Host' : 'Guest');
        if (recorderName !== myName) {
          if (recActive) {
            playChime('knock');
            showToast('Recording Started', `${recorderName || 'Host'} started recording this session`, 'info');
          } else {
            showToast('Recording Stopped', `${recorderName || 'Host'} stopped recording`, 'info');
          }
        }
      } else if (msg.type === 'TRANSCRIPT_ENTRY') {
        if (msg.payload?.speaker && msg.payload?.text) {
          setMeetingNotes((prev) => {
            if (prev.some((n) => n.id === msg.payload.id)) return prev;
            return [...prev, msg.payload];
          });
          setInterimTranscript(null);
          const sName = (msg.payload.speaker || '').trim().toLowerCase();
          setActiveSpeakers((prev) => new Set(prev).add(sName));
          setTimeout(() => {
            setActiveSpeakers((prev) => {
              const next = new Set(prev);
              next.delete(sName);
              return next;
            });
          }, 2500);
        }
      } else if (msg.type === 'TRANSCRIPT_UPDATE') {
        if (msg.payload?.id && msg.payload?.text) {
          setMeetingNotes((prev) =>
            prev.map((n) =>
              n.id === msg.payload.id
                ? { ...n, text: msg.payload.text, time: msg.payload.time || n.time, timestamp: msg.payload.timestamp || n.timestamp }
                : n
            )
          );
          setInterimTranscript(null);
          const sName = (msg.payload.speaker || '').trim().toLowerCase();
          if (sName) setActiveSpeakers((prev) => new Set(prev).add(sName));
        }
      } else if (msg.type === 'TRANSCRIPT_INTERIM') {
        if (msg.payload?.speaker && msg.payload?.text) {
          setInterimTranscript(msg.payload);
          const sName = (msg.payload.speaker || '').trim().toLowerCase();
          setActiveSpeakers((prev) => new Set(prev).add(sName));
        }
      } else if (msg.type === 'SPEAKER_ACTIVE') {
        const sName = (msg.payload?.name || '').trim().toLowerCase();
        if (sName) {
          setActiveSpeakers((prev) => {
            const next = new Set(prev);
            if (msg.payload.isSpeaking) next.add(sName);
            else next.delete(sName);
            return next;
          });
        }
      } else if (msg.type === 'PEER_RESYNC') {
        // A peer just returned from another app / lock screen
        if (transportMode !== 'livekit' && inCall && msg.payload.name !== userName) {
          try {
            const pc = createPeerConnection(msg.payload.name);
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: userName || (isHost ? 'Host' : 'Guest'),
              to: msg.payload.name,
              type: 'offer',
              sdp: offer,
            });
          } catch {}
        }
      } else if (msg.type === 'WEBRTC_SIGNAL') {
        if (transportMode === 'livekit') return;
        const { from, to, type, sdp, candidate } = msg.payload;
        const myName = userName || (isHost ? 'Host' : 'Guest');
        if (to !== myName) return;

        // Auto-ensure 'from' is in participants list
        const fromNormalized = (from || '').trim().toLowerCase();
        const myNormalized = (myName || '').trim().toLowerCase();
        if (fromNormalized && fromNormalized !== myNormalized) {
          setParticipants((prev) => {
            if (prev.some((p) => (p.name || '').trim().toLowerCase() === fromNormalized)) return prev;
            return [
              ...prev,
              {
                id: 'peer-' + from.trim(),
                name: from.trim(),
                isHost: fromNormalized === 'host' || fromNormalized.includes('host'),
                audioEnabled: true,
                videoEnabled: true,
                handRaised: false,
                isScreenSharing: false,
                joinedAt: Date.now(),
              },
            ];
          });
        }

        let pc = peerConnectionsRef.current[from] || createPeerConnection(from);

        try {
          if (type === 'offer') {
            if (pc.signalingState !== 'stable') {
              try {
                await pc.setLocalDescription({ type: 'rollback' });
              } catch {
                pc.close();
                pc = createPeerConnection(from);
              }
            }
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            // Drain queued ICE candidates
            const pending = pendingCandidatesRef.current[from] || [];
            for (const cand of pending) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }
            pendingCandidatesRef.current[from] = [];

            // Ensure local tracks are attached before answering
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                const hasSender = pc.getSenders().find((s) => s.track?.kind === track.kind);
                if (!hasSender) {
                  pc.addTrack(track, localStreamRef.current!);
                }
              });
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: myName,
              to: from,
              type: 'answer',
              sdp: answer,
            });
          } else if (type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));

              // Drain queued ICE candidates
              const pending = pendingCandidatesRef.current[from] || [];
              for (const cand of pending) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {}
              }
              pendingCandidatesRef.current[from] = [];
            }
          } else if (type === 'candidate' && candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (candErr) {
                console.warn('ICE candidate addition skipped:', candErr);
              }
            } else {
              // Queue candidate until remoteDescription is set!
              pendingCandidatesRef.current[from] = [
                ...(pendingCandidatesRef.current[from] || []),
                candidate,
              ];
            }
          }
        } catch (e) {
          console.log('WebRTC signaling error:', e);
        }
      }
    };

    const channel = new MeetChannel(meetingId, handleChannelMessage);
    channelRef.current = channel;

    channel.send('PING_HOST', { timestamp: Date.now() });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === `meet_event_${meetingId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleChannelMessage(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorage);
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      screenSendersRef.current = {};
      screenAudioSendersRef.current = {};
      pendingCandidatesRef.current = {};
    };
  }, [
    meetingId,
    isHost,
    userName,
    inCall,
    transportMode,
    participantId,
    sendHostEvent,
    createPeerConnection,
    showToast,
  ]);

  // Real-time Web Speech Recognition & AI Live Notes (Continuous & Resilient)
  useEffect(() => {
    if (!inCall) return;

    const SpeechRecognitionClass =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognitionClass) {
      console.warn('[SpeechRecognition] Web Speech API not supported in this browser.');
      return;
    }

    let isStopped = false;
    let recognition: any = null;
    let restartTimeout: NodeJS.Timeout | null = null;

    const safeStart = () => {
      if (isStopped || !inCall || !micEnabled || !recognition) return;
      try {
        recognition.start();
      } catch (err: any) {
        const msg = err?.message || '';
        // If already active, great; otherwise schedule retry in 300ms
        if (!msg.includes('already started')) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(safeStart, 300);
        }
      }
    };

    try {
      recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        isStartingOrRunningRef.current = true;
      };

      recognition.onresult = (event: any) => {
        const myName = (userName || (isHost ? 'Host' : 'Guest')).trim();
        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalStr += ' ' + item[0].transcript;
          } else {
            interim += ' ' + item[0].transcript;
          }
        }

        const trimmedFinal = finalStr.trim();
        const trimmedInterim = interim.trim();

        if (trimmedInterim) {
          setInterimTranscript({ speaker: myName, text: trimmedInterim });
          setActiveSpeakers((prev) => new Set(prev).add(myName.toLowerCase()));
          channelRef.current?.send('TRANSCRIPT_INTERIM', {
            speaker: myName,
            text: trimmedInterim,
          });
        }

        if (trimmedFinal) {
          setInterimTranscript(null);
          const now = Date.now();
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          setMeetingNotes((prev) => {
            const lastNote = prev[prev.length - 1];
            // If the same speaker spoke within the last 8 seconds, seamlessly merge and move to next line after a certain length!
            if (
              lastNote &&
              lastNote.speaker.trim().toLowerCase() === myName.toLowerCase() &&
              (now - lastNote.timestamp) < 8000
            ) {
              const prevText = lastNote.text.trim();
              const lastLine = prevText.split('\n').pop() || '';
              // Move to the next line if the current line exceeds 65 characters
              const separator = (lastLine.length + trimmedFinal.length > 65) ? '\n' : ' ';
              const updatedNote = {
                ...lastNote,
                text: `${prevText}${separator}${trimmedFinal}`,
                time: timeStr,
                timestamp: now,
              };
              channelRef.current?.send('TRANSCRIPT_UPDATE', updatedNote);
              return [...prev.slice(0, -1), updatedNote];
            }

            // Otherwise, create a new transcript block
            const newEntry = {
              id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
              speaker: myName,
              text: trimmedFinal,
              time: timeStr,
              timestamp: now,
              isAutoTranscript: true,
            };
            channelRef.current?.send('TRANSCRIPT_ENTRY', newEntry);
            return [...prev, newEntry];
          });

          setActiveSpeakers((prev) => new Set(prev).add(myName.toLowerCase()));
          setTimeout(() => {
            setActiveSpeakers((prev) => {
              const next = new Set(prev);
              next.delete(myName.toLowerCase());
              return next;
            });
          }, 2500);
        }
      };

      recognition.onerror = (err: any) => {
        isStartingOrRunningRef.current = false;
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          console.warn('[SpeechRecognition] Microphone permission denied');
          isStopped = true;
          return;
        }
        // For 'no-speech', 'audio-capture', 'network', 'aborted': automatically restart
        if (!isStopped && inCall && micEnabled) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(safeStart, 300);
        }
      };

      recognition.onend = () => {
        isStartingOrRunningRef.current = false;
        // Keep listening continuously as long as mic is enabled and in call
        if (!isStopped && inCall && micEnabled) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(safeStart, 200);
        }
      };

      if (micEnabled) {
        safeStart();
      }
    } catch (err) {
      console.warn('[SpeechRecognition] Initialization failed:', err);
    }

    // Liveness watchdog: checks every 2.5s and revives speech recognition if the browser dropped it
    const watchdogTimer = setInterval(() => {
      if (!isStopped && inCall && micEnabled && !isStartingOrRunningRef.current) {
        safeStart();
      }
    }, 2500);

    return () => {
      isStopped = true;
      if (restartTimeout) clearTimeout(restartTimeout);
      clearInterval(watchdogTimer);
      isStartingOrRunningRef.current = false;
      try {
        recognition?.abort();
      } catch {}
      recognitionRef.current = null;
    };
  }, [inCall, micEnabled, userName, isHost]);

  // Sync active speaker status based on microphone audio volume
  useEffect(() => {
    if (!inCall) return;
    const myName = (userName || (isHost ? 'Host' : 'Guest')).trim().toLowerCase();
    const isSpeakingNow = micEnabled && audioVolume > 15;

    if (isSpeakingNow && !isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = true;
      setActiveSpeakers((prev) => new Set(prev).add(myName));
      channelRef.current?.send('SPEAKER_ACTIVE', { name: myName, isSpeaking: true });
    } else if (!isSpeakingNow && isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = false;
      setActiveSpeakers((prev) => {
        const next = new Set(prev);
        next.delete(myName);
        return next;
      });
      channelRef.current?.send('SPEAKER_ACTIVE', { name: myName, isSpeaking: false });
    }
  }, [inCall, micEnabled, audioVolume, userName, isHost]);

  const isLocalSpeaking =
    (micEnabled && audioVolume > 15) ||
    activeSpeakers.has((userName || (isHost ? 'Host' : 'Guest')).trim().toLowerCase());

  // Dominant active speaker tracking (with a 2.2s smoothing hold to prevent jerky layout switches)
  useEffect(() => {
    const localNorm = (userName || (isHost ? 'Host' : 'Guest')).trim().toLowerCase();
    const isLocalSpk = (micEnabled && audioVolume > 15) || activeSpeakers.has(localNorm);

    // Find remote speaker if any
    const remoteSpeaker = otherParticipants.find((p) =>
      activeSpeakers.has(p.name.trim().toLowerCase())
    );

    let speaker: string | null = null;
    if (remoteSpeaker) {
      speaker = remoteSpeaker.name.trim().toLowerCase();
    } else if (isLocalSpk) {
      speaker = localNorm;
    }

    if (speaker) {
      if (dominantSpeakerTimerRef.current) clearTimeout(dominantSpeakerTimerRef.current);
      setDominantSpeaker(speaker);
      dominantSpeakerTimerRef.current = setTimeout(() => {
        setDominantSpeaker(null);
      }, 2200);
    }
  }, [activeSpeakers, audioVolume, micEnabled, otherParticipants, userName, isHost]);

  const localNormName = (userName || (isHost ? 'Host' : 'Guest')).trim().toLowerCase();
  const isLocalDominant = dominantSpeaker === localNormName;

  // Auto-scroll Notes to bottom when new note arrives
  useEffect(() => {
    if (activePanel === 'notes') {
      notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [meetingNotes, interimTranscript, activePanel]);

  // Add Custom / Manual Note
  const handleAddCustomNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCustomNote.trim()) return;

    const myName = (userName || (isHost ? 'Host' : 'Guest')).trim();
    const newEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      speaker: myName,
      text: newCustomNote.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      isAutoTranscript: false,
    };

    setMeetingNotes((prev) => [...prev, newEntry]);
    channelRef.current?.send('TRANSCRIPT_ENTRY', newEntry);
    setNewCustomNote('');
    triggerHaptic('light');
    showToast('Note Added', 'Note shared with all participants', 'info');
  };

  // Copy All Notes to Clipboard
  const copyAllNotes = () => {
    triggerHaptic('medium');
    const formatted = meetingNotes
      .map((n) => `[${n.time}] ${n.speaker}: "${n.text}"`)
      .join('\n\n');
    navigator.clipboard.writeText(formatted);
    showToast('Notes Copied', 'Meeting transcripts copied to clipboard', 'info');
  };

  // Download Notes as Word document (.doc)
  const downloadNotes = () => {
    triggerHaptic('medium');

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const dateStr = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = new Date().toLocaleTimeString();

    const notesHtml = meetingNotes.length === 0
      ? '<p style="color: #64748b; font-style: italic;">No meeting transcripts recorded yet.</p>'
      : meetingNotes
          .map((n) => {
            const speakerEsc = escapeXml(n.speaker || 'Participant');
            const timeEsc = escapeXml(n.time || '');
            const typeEsc = escapeXml(n.isAutoTranscript ? 'Spoken' : 'Manual Note');
            const textEsc = escapeXml(n.text || '').replace(/\n/g, '<br/>');
            return `
              <div style="margin-bottom: 12pt; padding: 8pt 12pt; background-color: #f8fafc; border-left: 3.5pt solid #2563eb; border-radius: 4pt;">
                <div style="margin-bottom: 3pt;">
                  <strong style="color: #1e40af; font-size: 11pt;">${speakerEsc}</strong>
                  <span style="display: inline-block; margin-left: 6pt; font-size: 8pt; background-color: #dbeafe; color: #1d4ed8; padding: 1pt 5pt; border-radius: 3pt; font-weight: bold; text-transform: uppercase;">${typeEsc}</span>
                  <span style="color: #64748b; font-size: 9pt; margin-left: 8pt;">${timeEsc}</span>
                </div>
                <div style="color: #334155; font-size: 10.5pt; line-height: 1.5; margin-top: 4pt;">${textEsc}</div>
              </div>`;
          })
          .join('');

    const docContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>JUMMP Meeting Notes - ${escapeXml(meetingId)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 11pt;
      color: #0f172a;
      line-height: 1.5;
      padding: 24pt;
    }
    h1 {
      color: #1e40af;
      font-size: 20pt;
      margin-bottom: 4pt;
      padding-bottom: 4pt;
      border-bottom: 2pt solid #2563eb;
    }
    .meta-box {
      margin-bottom: 18pt;
      padding: 8pt 12pt;
      background-color: #f1f5f9;
      border-radius: 4pt;
      font-size: 9.5pt;
      color: #475569;
    }
    .meta-line {
      margin-bottom: 2pt;
    }
    .meta-label {
      font-weight: bold;
      color: #1e293b;
    }
    .section-title {
      font-size: 13pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 16pt;
      margin-bottom: 10pt;
      padding-bottom: 4pt;
      border-bottom: 1pt solid #cbd5e1;
    }
    .footer {
      margin-top: 28pt;
      padding-top: 8pt;
      border-top: 1pt solid #e2e8f0;
      font-size: 8.5pt;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>JUMMP &bull; Live Meeting Notes &amp; Transcripts</h1>
  <div class="meta-box">
    <div class="meta-line"><span class="meta-label">Meeting Room:</span> ${escapeXml(meetingId)}</div>
    <div class="meta-line"><span class="meta-label">Date &amp; Time:</span> ${dateStr} at ${timeStr}</div>
    <div class="meta-line"><span class="meta-label">Total Notes:</span> ${meetingNotes.length} entry/entries</div>
  </div>

  <div class="section-title">Meeting Transcripts &amp; Records</div>
  ${notesHtml}

  <div class="footer">
    Exported automatically from JUMMP Meet &bull; AI Live Speech Recognition
  </div>
</body>
</html>`;

    // \ufeff BOM ensures UTF-8 character encoding is recognized by Microsoft Word
    const blob = new Blob(['\ufeff', docContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jummp-notes-${meetingId}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Document Downloaded', 'Saved meeting notes as Word document (.doc)', 'info');
  };

  // Toggle Camera
  const toggleCam = async () => {
    triggerHaptic('light');
    const nextState = !camEnabled;
    setCamEnabled(nextState);
    const myName = userName || (isHost ? 'Host' : 'Guest');

    if (nextState) {
      // Unmuting video: ensure a live video track exists
      let liveTrack = localStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
      if (liveTrack) {
        liveTrack.enabled = true;
      } else {
        try {
          const freshMedia = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          const freshTrack = freshMedia.getVideoTracks()[0];
          if (freshTrack) {
            if (localStreamRef.current) {
              localStreamRef.current.getVideoTracks().forEach((t) => {
                localStreamRef.current?.removeTrack(t);
                t.stop();
              });
              localStreamRef.current.addTrack(freshTrack);
            } else {
              localStreamRef.current = freshMedia;
              setLocalStream(freshMedia);
            }
            liveTrack = freshTrack;

            // Update all WebRTC peer connections with the fresh video track
            Object.entries(peerConnectionsRef.current).forEach(async ([peerName, pc]) => {
              try {
                const videoSender = pc
                  .getSenders()
                  .find(
                    (sender) =>
                      sender.track?.kind === 'video' && sender !== screenSendersRef.current[peerName]
                  );
                if (videoSender) {
                  await videoSender.replaceTrack(freshTrack);
                } else {
                  pc.addTrack(freshTrack, localStreamRef.current!);
                  const offer = await pc.createOffer();
                  await pc.setLocalDescription(offer);
                  channelRef.current?.send('WEBRTC_SIGNAL', {
                    from: myName,
                    to: (pc as any)._targetPeer || '',
                    type: 'offer',
                    sdp: offer,
                  });
                }
              } catch (e) {
                console.warn('WebRTC track update error:', e);
              }
            });
          }
        } catch (err) {
          console.warn('Failed to start camera:', err);
          setCamEnabled(false);
          return;
        }
      }

      // Rebind to local video elements immediately
      if (inCallVideoRef.current && localStreamRef.current) {
        inCallVideoRef.current.srcObject = localStreamRef.current;
        inCallVideoRef.current.play().catch(() => {});
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      document.querySelectorAll('video[data-self-video="true"]').forEach((vid) => {
        const v = vid as HTMLVideoElement;
        v.defaultMuted = true;
        v.muted = true;
        const stream = localStreamRef.current || localStream;
        if (stream && v.srcObject !== stream) {
          v.srcObject = stream;
        }
        v.play().catch(() => {});
      });
    } else {
      // Muting video: disable all video tracks
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.enabled = false;
        });
      }
    }

    if (livekitRoomRef.current) {
      livekitRoomRef.current.localParticipant.setCameraEnabled(nextState).catch(() => {});
    }

    // Update self in participants list
    setParticipants((prev) =>
      prev.map((p) => (p.name === myName ? { ...p, videoEnabled: nextState } : p))
    );

    channelRef.current?.send('MEDIA_STATE_UPDATE', {
      participantName: myName,
      audioEnabled: micEnabled,
      videoEnabled: nextState,
    });
  };

  // Toggle Mic
  const toggleMic = async () => {
    triggerHaptic('light');
    const nextState = !micEnabled;
    setMicEnabled(nextState);
    const myName = userName || (isHost ? 'Host' : 'Guest');

    if (nextState) {
      let liveAudio = localStreamRef.current?.getAudioTracks().find((t) => t.readyState === 'live');
      if (liveAudio) {
        liveAudio.enabled = true;
      } else {
        try {
          const freshMedia = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          const freshAudio = freshMedia.getAudioTracks()[0];
          if (freshAudio) {
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => {
                localStreamRef.current?.removeTrack(t);
                t.stop();
              });
              localStreamRef.current.addTrack(freshAudio);
            } else {
              localStreamRef.current = freshMedia;
              setLocalStream(freshMedia);
            }
            Object.entries(peerConnectionsRef.current).forEach(async ([peerName, pc]) => {
              try {
                const audioSender = pc
                  .getSenders()
                  .find(
                    (sender) =>
                      sender.track?.kind === 'audio' &&
                      sender !== screenAudioSendersRef.current[peerName]
                  );
                if (audioSender) {
                  await audioSender.replaceTrack(freshAudio);
                } else {
                  pc.addTrack(freshAudio, localStreamRef.current!);
                }
              } catch (e) {}
            });
          }
        } catch (err) {
          console.warn('Failed to start microphone:', err);
          setMicEnabled(false);
          return;
        }
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
    }

    if (livekitRoomRef.current) {
      livekitRoomRef.current.localParticipant.setMicrophoneEnabled(nextState).catch(() => {});
    }

    // Update self in participants list
    setParticipants((prev) =>
      prev.map((p) => (p.name === myName ? { ...p, audioEnabled: nextState } : p))
    );

    channelRef.current?.send('MEDIA_STATE_UPDATE', {
      participantName: myName,
      audioEnabled: nextState,
      videoEnabled: camEnabled,
    });
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    const myName = userName || (isHost ? 'Host' : 'Guest');

    if (isScreenSharing) {
      if (screenStream) {
        if (livekitRoomRef.current) {
          screenStream.getTracks().forEach((track) => {
            livekitRoomRef.current?.localParticipant.unpublishTrack(track);
          });
        }
        screenStream.getTracks().forEach((t) => t.stop());
      }
      localScreenStreamRef.current = null;
      setScreenStream(null);
      setIsScreenSharing(false);
      setShowScreenPreview(false);
      setActiveScreenSharer(null);

      // Remove screen senders from all peer connections and renegotiate
      Object.entries(peerConnectionsRef.current).forEach(async ([peerName, pc]) => {
        try {
          const sender = screenSendersRef.current[peerName];
          if (sender) {
            pc.removeTrack(sender);
            delete screenSendersRef.current[peerName];
          }
          const audioSender = screenAudioSendersRef.current[peerName];
          if (audioSender) {
            pc.removeTrack(audioSender);
            delete screenAudioSendersRef.current[peerName];
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channelRef.current?.send('WEBRTC_SIGNAL', {
            from: myName,
            to: peerName,
            type: 'offer',
            sdp: offer,
          });
        } catch (e) {}
      });

      channelRef.current?.send('SCREEN_SHARE_STOPPED', { sharerName: myName });
      if (livekitRoomRef.current) {
        livekitRoomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
      }
    } else {
      // Enforce one screen share at a time
      if (activeScreenSharer && activeScreenSharer !== myName) {
        setScreenShareError(`${activeScreenSharer} is currently presenting. Only one person can share at a time.`);
        setTimeout(() => setScreenShareError(null), 4000);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        } as any);
        setScreenStream(stream);
        localScreenStreamRef.current = stream;
        setIsScreenSharing(true);
        setShowScreenPreview(false);
        setActiveScreenSharer(myName);

        const screenTrack = stream.getVideoTracks()[0];
        if (screenTrack) {
          (screenTrack as any).contentHint = 'detail';
        }
        const screenStreamId = stream.id;
        const screenTrackId = screenTrack?.id;

        // Publish screen track to all connected WebRTC peers
        Object.entries(peerConnectionsRef.current).forEach(async ([peerName, pc]) => {
          try {
            if (screenTrack) {
              const sender = pc.addTrack(screenTrack, stream);
              screenSendersRef.current[peerName] = sender;
            }
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
              screenAudioSendersRef.current[peerName] = pc.addTrack(audioTrack, stream);
            }
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: myName,
              to: peerName,
              type: 'offer',
              sdp: offer,
            });
          } catch (e) {
            console.warn('Screen share offer error to', peerName, e);
          }
        });

        // Broadcast to all participants in the room
        channelRef.current?.send('SCREEN_SHARE_STARTED', {
          sharerName: myName,
          streamId: screenStreamId,
          trackId: screenTrackId,
        });

        if (livekitRoomRef.current && screenTrack) {
          await livekitRoomRef.current.localParticipant.publishTrack(screenTrack, {
            source: Track.Source.ScreenShare,
          });
          const screenAudioTrack = stream.getAudioTracks()[0];
          if (screenAudioTrack) {
            await livekitRoomRef.current.localParticipant.publishTrack(screenAudioTrack, {
              source: Track.Source.ScreenShareAudio,
            });
          }
        }

        // Native browser "Stop sharing" bar click handler
        if (screenTrack) {
          screenTrack.onended = () => {
            if (stream) {
              if (livekitRoomRef.current) {
                stream.getTracks().forEach((track) => {
                  livekitRoomRef.current?.localParticipant.unpublishTrack(track);
                });
              }
              stream.getTracks().forEach((t) => t.stop());
            }
            localScreenStreamRef.current = null;
            setScreenStream(null);
            setIsScreenSharing(false);
            setShowScreenPreview(false);
            setActiveScreenSharer(null);

            Object.entries(peerConnectionsRef.current).forEach(async ([peerName, pc]) => {
              try {
                const sender = screenSendersRef.current[peerName];
                if (sender) {
                  pc.removeTrack(sender);
                  delete screenSendersRef.current[peerName];
                }
                const audioSender = screenAudioSendersRef.current[peerName];
                if (audioSender) {
                  pc.removeTrack(audioSender);
                  delete screenAudioSendersRef.current[peerName];
                }
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channelRef.current?.send('WEBRTC_SIGNAL', {
                  from: myName,
                  to: peerName,
                  type: 'offer',
                  sdp: offer,
                });
              } catch (e) {}
            });

            channelRef.current?.send('SCREEN_SHARE_STOPPED', { sharerName: myName });
            if (livekitRoomRef.current) {
              livekitRoomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
            }
          };
        }
      } catch (err) {
        console.log('Screen share cancelled or failed:', err);
      }
    }
  };

  // Reactions
  const triggerReaction = (emoji: string, broadcast = true) => {
    triggerHaptic('light');
    const id = Date.now() + Math.random();
    setFloatingReactions((prev) => [...prev, { id, emoji }]);
    if (broadcast && channelRef.current) {
      channelRef.current.send('REACTION', { emoji });
    }
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  };

  // =========================================================================
  // PARTICIPANT MODERATION: MUTE AUDIO & STOP VIDEO (Individual + All)
  // =========================================================================
  const handleMuteParticipantAudio = (participantName: string) => {
    triggerHaptic('medium');
    const myName = userName || (isHost ? 'Host' : 'Guest');

    if (isHost) {
      // Host sends remote mute command
      void sendHostEvent('MUTE_PARTICIPANT_AUDIO', {
        targetName: participantName,
        byHost: myName,
      });
      setParticipants((prev) =>
        prev.map((p) => (p.name === participantName ? { ...p, audioEnabled: false } : p))
      );
      showToast('Participant Muted', `Muted ${participantName}'s microphone`, 'info');
    } else {
      // Non-host toggles local audio mute for this participant
      const isMuted = Boolean(locallyMutedAudio[participantName]);
      setLocallyMutedAudio((prev) => ({
        ...prev,
        [participantName]: !isMuted,
      }));
      showToast(
        isMuted ? 'Audio Unmuted' : 'Audio Muted',
        `${participantName}'s sound ${isMuted ? 'unmuted' : 'muted for you'}`,
        'info'
      );
    }
  };

  const handleMuteAllAudio = () => {
    triggerHaptic('heavy');
    const myName = userName || (isHost ? 'Host' : 'Guest');
    void sendHostEvent('MUTE_ALL_AUDIO', { byHost: myName });
    setParticipants((prev) =>
      prev.map((p) => (!p.isHost ? { ...p, audioEnabled: false } : p))
    );
    showToast('Mute All', 'All participant microphones have been muted', 'info');
  };

  const handleStopParticipantVideo = (participantName: string) => {
    triggerHaptic('medium');
    const myName = userName || (isHost ? 'Host' : 'Guest');

    if (isHost) {
      void sendHostEvent('STOP_PARTICIPANT_VIDEO', {
        targetName: participantName,
        byHost: myName,
      });
      setParticipants((prev) =>
        prev.map((p) => (p.name === participantName ? { ...p, videoEnabled: false } : p))
      );
      showToast('Video Stopped', `Stopped ${participantName}'s video`, 'info');
    } else {
      // Non-host hides video locally
      const isHidden = Boolean(locallyMutedVideo[participantName]);
      setLocallyMutedVideo((prev) => ({
        ...prev,
        [participantName]: !isHidden,
      }));
      showToast(
        isHidden ? 'Video Shown' : 'Video Hidden',
        `${participantName}'s video ${isHidden ? 'shown' : 'hidden for you'}`,
        'info'
      );
    }
  };

  const handleStopAllVideo = () => {
    triggerHaptic('heavy');
    const myName = userName || (isHost ? 'Host' : 'Guest');
    void sendHostEvent('STOP_ALL_VIDEO', { byHost: myName });
    setParticipants((prev) =>
      prev.map((p) => (!p.isHost ? { ...p, videoEnabled: false } : p))
    );
    showToast('Stop All Video', 'All participant video cameras turned off', 'info');
  };

  // Toggle Hand Raise (Synchronized across all participants)
  const toggleHandRaise = () => {
    triggerHaptic('medium');
    playChime('hand');
    const myName = userName || (isHost ? 'Host' : 'Guest');
    const nextState = !handRaised;
    setHandRaised(nextState);

    // Update local participant state in roster
    setParticipants((prev) =>
      prev.map((p) => (p.name === myName ? { ...p, handRaised: nextState } : p))
    );

    // Broadcast HAND_RAISE over Realtime signaling
    channelRef.current?.send('HAND_RAISE', {
      name: myName,
      handRaised: nextState,
    });

    if (nextState) {
      showToast('Hand Raised', 'Other participants can see you raised your hand', 'info');
    } else {
      showToast('Hand Lowered', 'You lowered your hand', 'info');
    }
  };

  // Join Action - Host joins directly, Guests ALWAYS require host approval
  const handleJoinClick = () => {
    triggerHaptic('medium');
    const name = userName.trim() || (isHost ? 'Host' : 'Guest User');
    setUserName(name);

    if (isHost) {
      playChime('admit');
      setWaitingToJoin(false);
      setInCall(true);
      const participant: Participant = {
        id: 'host-' + Date.now(),
        name,
        isHost: true,
        audioEnabled: micEnabled,
        videoEnabled: camEnabled,
        handRaised: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
      };
      // Local host is already rendered via local user video tile. Keep participants strictly for remote peers.
      setParticipants((prev) => prev.filter((p) => p.name.trim().toLowerCase() !== name.toLowerCase() && !p.isHost));
      void sendHostEvent('HOST_ARRIVED', { hostName: name });
      channelRef.current?.send('USER_JOINED', participant);
      upsertParticipant(meetingId, name, 'host', 'admitted').catch(() => {});
    } else {
      // Guest: Approval is strictly required! No open access bypass.
      playChime('knock');
      setWaitingToJoin(true);
      const req: JoinRequest = {
        id: participantId,
        name,
        meetingId,
        requestedAt: Date.now(),
      };
      channelRef.current?.send('REQUEST_JOIN', req);
    }
  };

  // Host Admits Guest - Passes existing roster so newcomer has all participants immediately
  const handleAdmitGuest = async (req: JoinRequest) => {
    if (!hostToken) return;
    const response = await fetch('/api/meet/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: meetingId,
        hostToken,
        participantId: req.id,
        name: req.name,
      }),
    });
    const admission = await response.json();
    if (!response.ok || !admission.admissionToken) {
      showToast('Admission failed', admission.error || 'Please try again.', 'info');
      return;
    }
    const myName = userName || (isHost ? 'Host' : 'Host');
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));

    const newParticipant: Participant = {
      id: req.id,
      name: req.name,
      isHost: false,
      audioEnabled: true,
      videoEnabled: true,
      handRaised: false,
      isScreenSharing: false,
      joinedAt: Date.now(),
    };
    setParticipants((prev) => [
      ...prev.filter((p) => p.name.trim().toLowerCase() !== req.name.trim().toLowerCase() && p.id !== req.id),
      newParticipant,
    ]);

    void sendHostEvent('ADMIT_GUEST', {
      guestName: req.name,
      guestId: req.id,
      admissionToken: admission.admissionToken,
      hostName: myName,
      existingParticipants: [
        ...participants.filter(
          (p) =>
            p.name.trim().toLowerCase() !== req.name.trim().toLowerCase() &&
            p.name.trim().toLowerCase() !== myName.trim().toLowerCase()
        ),
        newParticipant,
      ],
    });
    upsertParticipant(meetingId, req.name, 'guest', 'admitted').catch(() => {});
  };

  // Host Denies Guest
  const handleDenyGuest = (req: JoinRequest) => {
    void sendHostEvent('DENY_GUEST', { guestName: req.name, guestId: req.id });
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  // Send Chat Message
  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChatText.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: userName || (isHost ? 'Host' : 'You'),
      text: newChatText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, msg]);
    channelRef.current?.send('CHAT_MESSAGE', msg);
    if (dbMeeting) {
      saveChatMessage(dbMeeting.id, userName || (isHost ? 'Host' : 'You'), newChatText.trim());
    }
    setNewChatText('');
  };

  // Copy Link
  const copyMeetingLink = () => {
    const fullUrl = getMeetingUrl(meetingId);
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download QR Code as a high-resolution .jpg image
  const downloadQrJpg = async () => {
    try {
      triggerHaptic('medium');
      const fullUrl = getMeetingUrl(meetingId);

      const canvas = document.createElement('canvas');
      const width = 1000;
      const height = 1180;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Solid White background (essential for JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Top decorative blue-cyan accent gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#0b5cff');
      gradient.addColorStop(1, '#06b6d4');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 20);

      // Brand Title
      ctx.fillStyle = '#0b5cff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JUMMP MEET', width / 2, 95);

      // Subtitle
      ctx.fillStyle = '#475569';
      ctx.font = '600 22px sans-serif';
      ctx.fillText('Scan with your phone camera to join', width / 2, 140);

      // Meeting Room ID box
      const pillW = 600;
      const pillH = 64;
      const pillX = (width - pillW) / 2;
      const pillY = 175;
      ctx.fillStyle = '#f1f5f9';
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(pillX, pillY, pillW, pillH, 16);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 24px monospace, sans-serif';
      ctx.fillText(`Meeting ID: ${meetingId}`, width / 2, pillY + 41);

      // Render high-res QR code onto an offscreen canvas
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, fullUrl, {
        width: 640,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      // Draw QR code with a subtle border
      const qrSize = 640;
      const qrX = (width - qrSize) / 2;
      const qrY = 275;

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // Link text & metadata
      ctx.fillStyle = '#64748b';
      ctx.font = '18px monospace, sans-serif';
      ctx.fillText(fullUrl, width / 2, 970);

      // Divider line
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(120, 1020);
      ctx.lineTo(width - 120, 1020);
      ctx.stroke();

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText('Encrypted HD Video & AI Transcripts • JUMMP', width / 2, 1065);

      // Export specifically as JPEG (.jpg)
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jummp-qr-${meetingId}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('QR Code Downloaded', 'Saved meeting QR code as .jpg', 'info');
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Error generating QR JPG:', err);
      showToast('Download Failed', 'Could not generate QR code image', 'info');
    }
  };

  // Share Meeting link or QR code
  const shareMeetingQr = async () => {
    try {
      triggerHaptic('medium');
      const fullUrl = getMeetingUrl(meetingId);

      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          // Attempt to share JPG file if device supports file sharing
          const canvas = document.createElement('canvas');
          const width = 800;
          const height = 960;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            const qrCanvas = document.createElement('canvas');
            await QRCode.toCanvas(qrCanvas, fullUrl, { width: 500, margin: 1 });
            ctx.drawImage(qrCanvas, 150, 200, 500, 500);
            ctx.fillStyle = '#0b5cff';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('JUMMP MEET', width / 2, 80);
            ctx.fillStyle = '#334155';
            ctx.font = '20px sans-serif';
            ctx.fillText(`Room: ${meetingId}`, width / 2, 130);
            ctx.fillText(fullUrl, width / 2, 760);
          }

          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob((b) => res(b), 'image/jpeg', 0.92)
          );

          if (
            blob &&
            navigator.canShare &&
            navigator.canShare({
              files: [new File([blob], `jummp-qr-${meetingId}.jpg`, { type: 'image/jpeg' })],
            })
          ) {
            const file = new File([blob], `jummp-qr-${meetingId}.jpg`, { type: 'image/jpeg' });
            await navigator.share({
              title: `Join JUMMP Meeting: ${meetingId}`,
              text: `Join my JUMMP video meeting room: ${fullUrl}`,
              files: [file],
            });
            return;
          }
        } catch {
          // Fall back to link sharing
        }

        await navigator.share({
          title: `Join JUMMP Meeting: ${meetingId}`,
          text: `Join my JUMMP video meeting room (${meetingId}):`,
          url: fullUrl,
        });
        showToast('Link Shared', 'Meeting invitation sent', 'info');
      } else {
        copyMeetingLink();
        showToast('Link Copied', 'Meeting link copied to clipboard', 'info');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.log('Share error:', err);
      }
    }
  };

  // Leave Call
  const handleLeaveCall = () => {
    triggerHaptic('heavy');
    playChime('leave');
    const myName = userName || (isHost ? 'Host' : 'Guest');
    if (channelRef.current) {
      channelRef.current.send('USER_LEFT', { name: myName, id: participantId });
    }
    markParticipantLeft(meetingId, myName).catch(() => {});

    // Stop and kill all local media hardware tracks immediately to release camera/mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        t.stop();
      });
      setLocalStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => {
        t.stop();
      });
      setScreenStream(null);
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      recordingStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    // Close all WebRTC peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current = {};

    if (livekitRoomRef.current) {
      livekitRoomRef.current.disconnect();
      livekitRoomRef.current = null;
    }
    setHasLeft(true);
    setInCall(false);
  };
  handleLeaveCallRef.current = handleLeaveCall;

  // Window unload & pagehide listeners: cleanly notify peers and Supabase when tab is closed, reloaded, or navigated away
  useEffect(() => {
    if (!inCall) return;

    const handleWindowUnload = () => {
      const myName = userName || (isHost ? 'Host' : 'Guest');
      channelRef.current?.send('USER_LEFT', { name: myName, id: participantId });
      if (livekitRoomRef.current) {
        try {
          livekitRoomRef.current.disconnect();
        } catch {}
      }
      markParticipantLeft(meetingId, myName).catch(() => {});
    };

    window.addEventListener('beforeunload', handleWindowUnload);
    window.addEventListener('pagehide', handleWindowUnload);
    return () => {
      window.removeEventListener('beforeunload', handleWindowUnload);
      window.removeEventListener('pagehide', handleWindowUnload);
    };
  }, [inCall, userName, isHost, meetingId, participantId]);

  // Reopen Expired or Ended Meeting
  const handleReopenMeeting = async () => {
    if (!isHost || !hostToken) {
      showToast('Host access required', 'Only the anonymous creator can reopen this room.', 'info');
      return;
    }
    setIsCheckingStatus(true);
    const meeting = await createOrGetMeeting(meetingId, 'Host');
    if (meeting) {
      setDbMeeting(meeting);
      setStatusCheck({
        exists: true,
        meeting,
        isExpired: false,
        isActive: false,
        isEnded: false,
        daysInactive: 0,
        message: 'Meeting room reopened and ready.',
      });
      setIsCheckingStatus(false);
      acquireMedia();
    }
  };

  const handleStartNewMeeting = async () => {
    try {
      const { room } = await createAnonymousMeeting();
      router.push(`/meet/${room}`);
    } catch (error) {
      console.error(error);
      showToast('Unable to start meeting', 'Please check the server configuration.', 'info');
    }
  };

  // =========================================================================
  // VIEW 0: CHECKING STATUS LOADER
  // =========================================================================
  if (isCheckingStatus) {
    return (
      <div className="h-[100dvh] bg-gradient-to-b from-[#030712] via-[#08122a] to-[#030712] text-white flex flex-col items-center justify-between p-6 selection:bg-blue-500/30 relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full max-w-4xl flex items-center justify-between z-10">
          <div className="relative h-8 w-28">
            <Image src="/assets/jummp-logo.png" alt="JUMMP" fill priority className="object-contain object-left" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{meetingId}</span>
          </div>
        </div>

        {/* Center Card */}
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-6 z-10 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
              <Video className="w-9 h-9 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#08122a] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Connecting to JUMMP Meet
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
              Setting up encrypted WebRTC media streams and room signaling...
            </p>
          </div>

          <div className="w-full max-w-xs">
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full w-2/3 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Encrypted Room • High Fidelity Audio & Video</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 z-10">
          JUMMP Meet • Instant Video Calling
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: EXPIRED MEETING SCREEN (When clicked after weeks of inactivity)
  // JUMMP Meet Lifecycle Handling
  // =========================================================================
  if (statusCheck?.isExpired || statusCheck?.isEnded) {
    const isEndedInactivity = statusCheck?.isEnded && !statusCheck?.isExpired;
    return (
      <div className="min-h-[100dvh] h-[100dvh] bg-slate-950 text-white flex flex-col justify-between selection:bg-blue-500/30">
        {/* Header */}
        <header className="px-5 py-3.5 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
          <Link href="/" className="relative h-7 w-24">
            <Image src="/assets/jummp-logo.png" alt="JUMMP" fill priority className="object-contain object-left" />
          </Link>
          <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
            {meetingId}
          </div>
        </header>

        {/* Expired / Ended Inactivity Notification Card */}
        <main className="max-w-md w-full mx-auto px-5 py-8 flex-1 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-250">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{isEndedInactivity ? 'Meeting Inactive' : 'Link Expired'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isEndedInactivity ? 'This meeting has ended' : 'This meeting link has expired'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              {isEndedInactivity
                ? 'This room was marked inactive because nobody was in the meeting for 10 minutes.'
                : `Per JUMMP Meet protocol, inactive links expire after 30 days. This room was inactive for ${statusCheck?.daysInactive || 0} days.`}
            </p>
          </div>

          <div className="w-full space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleStartNewMeeting}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start a new meeting</span>
            </button>

            {isHost && (
              <button
                type="button"
                onClick={handleReopenMeeting}
                className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reopen this exact room</span>
              </button>
            )}

            <Link
              href="/"
              className="w-full py-3 px-4 rounded-2xl bg-transparent hover:bg-slate-900 text-slate-400 font-medium text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Return to home</span>
            </Link>
          </div>
        </main>

        <footer className="p-3.5 text-center text-xs text-slate-500 border-t border-slate-900">
          JUMMP Meet • Secure Protocol
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: POST-CALL SCREEN ("You left the meeting")
  // =========================================================================
  if (hasLeft) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] bg-slate-950 text-white flex flex-col justify-between selection:bg-blue-500/30">
        <header className="px-5 py-3.5 flex items-center justify-between border-b border-slate-900 bg-slate-950/80">
          <Link href="/" className="relative h-7 w-24">
            <Image src="/assets/jummp-logo.png" alt="JUMMP" fill priority className="object-contain object-left" />
          </Link>
          <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
            {meetingId}
          </div>
        </header>

        <main className="max-w-md w-full mx-auto px-5 py-8 flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-[#0b5cff] shadow-xl">
            <PhoneOff className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              You left the meeting
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Want to jump back in? You can rejoin anytime using this same link.
            </p>
          </div>

          <div className="w-full space-y-2.5 pt-2">
            <button
              type="button"
              onClick={async () => {
                setHasLeft(false);
                setInCall(false);
                setWaitingToJoin(false);
                setDenied(false);
                await acquireMedia();
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rejoin call</span>
            </button>

            <Link
              href="/"
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Return to home screen</span>
            </Link>
          </div>
        </main>

        <footer className="p-3.5 text-center text-xs text-slate-500 border-t border-slate-900">
          JUMMP Meet • Secure Protocol
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: JUMMP MEET GREEN ROOM / PRE-JOIN LOBBY (Mobile Viewport Masterpiece)
  // =========================================================================
  if (!inCall) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] bg-slate-950 text-white flex flex-col justify-between selection:bg-blue-500/30 overflow-hidden">
        {/* Top Header */}
        <header className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-slate-900/90 bg-slate-950/80 backdrop-blur-md shrink-0 z-20">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative h-7 w-24">
              <Image src="/assets/jummp-logo.png" alt="JUMMP" fill priority className="object-contain object-left" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-l border-slate-800 pl-2.5">
              Meet
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyMeetingLink}
              className="text-xs font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-blue-500/40 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <span>{meetingId}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
            </button>
          </div>
        </header>

        {/* Main Lobby Viewport */}
        <main className="max-w-4xl w-full mx-auto px-4 py-4 sm:py-8 flex-1 flex flex-col md:flex-row items-center justify-center gap-5 sm:gap-8 overflow-y-auto">
          {/* Left: Camera Preview Card */}
          <div className="w-full md:w-3/5 space-y-3">
            <div className="relative aspect-[4/3] sm:aspect-video rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-2xl flex items-center justify-center group">
              {camEnabled ? (
                <video
                  data-self-video="true"
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el) {
                      el.defaultMuted = true;
                      el.muted = true;
                      const stream = localStreamRef.current || localStream;
                      if (stream && el.srcObject !== stream) {
                        el.srcObject = stream;
                      }
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300 shadow-inner">
                    {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
                  </div>
                  <span className="text-xs font-semibold text-slate-400">Camera is off</span>
                </div>
              )}

              {/* Real-time Voice Audio Visualizer Wave */}
              {micEnabled && audioVolume > 5 && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-emerald-400 text-xs font-medium animate-in fade-in">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider font-bold">Speaking</span>
                  <div className="flex items-end gap-0.5 h-3 ml-1">
                    <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-1" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-2" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-3" />
                  </div>
                </div>
              )}

              {/* Floating Bottom Media Toggles */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-slate-950/80 backdrop-blur-xl px-3.5 py-2 rounded-2xl border border-white/10 shadow-2xl">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-3 rounded-xl transition-all active:scale-95 ${
                    micEnabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
                  }`}
                  title={micEnabled ? 'Turn off mic' : 'Turn on mic'}
                >
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleCam}
                  className={`p-3 rounded-xl transition-all active:scale-95 ${
                    camEnabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
                  }`}
                  title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Audio Indicator */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
              <span className="flex items-center gap-1.5">
                <Volume2 className={`w-3.5 h-3.5 ${micEnabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                {micEnabled ? 'Microphone active' : 'Microphone muted'}
              </span>
              <span className="text-slate-500 font-mono">HD Studio Audio</span>
            </div>
          </div>

          {/* Right: Join Form */}
          <div className="w-full md:w-2/5 space-y-4 sm:space-y-6 text-center md:text-left">
            <div>
              {/* Presence Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 mb-2.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {participants.length > 0
                    ? `${participants.length} in this call`
                    : hostInMeeting
                    ? 'Host is in the meeting'
                    : 'No one else is here yet'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {isHost ? 'Ready to lead the call?' : 'Ready to join?'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {isHost
                  ? 'You are entering as host. You have full controls.'
                  : 'Start or join this call directly with instant HD audio and video.'}
              </p>
            </div>

            {denied ? (
              <div className="p-5 rounded-2xl bg-red-950/60 border border-red-800 text-red-300 text-xs sm:text-sm text-center space-y-3 animate-in fade-in">
                <p className="font-bold">Entry was declined by the host.</p>
                <p className="text-xs text-red-400">You cannot enter this meeting at this time.</p>
                <Link
                  href="/"
                  className="inline-block px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
                >
                  Return to Home
                </Link>
              </div>
            ) : waitingToJoin ? (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-blue-500/40 text-center space-y-4 animate-in fade-in duration-300">
                <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  <Users className="w-5 h-5 text-blue-400 absolute" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">Waiting for host to let you in...</h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Only admitted guests can join this call. The host will review your request shortly.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingToJoin(false);
                      channelRef.current?.send('CANCEL_REQUEST_JOIN', { name: userName });
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
                  >
                    Cancel request
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-left">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder={isHost ? 'Host' : 'Your name'}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-white text-sm focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleJoinClick}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-95 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <span>{isHost ? 'Join now' : 'Ask to join'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={copyMeetingLink}
                      className="w-full py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied!' : 'Copy link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="w-full py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="w-4 h-4 text-blue-400" />
                      <span>Show QR</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="p-3.5 text-center text-xs text-slate-500 border-t border-slate-900 shrink-0">
          Encrypted with Enterprise WebRTC • JUMMP Meet
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: ACTIVE IN-CALL JUMMP MEET EXPERIENCE (Mobile Viewport Masterpiece)
  // =========================================================================

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-slate-950 text-white flex flex-col overflow-hidden select-none relative">
      {/* BACKGROUND RESYNC BANNER (App switching recovery banner) */}
      {isResyncing && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-blue-600/90 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 border border-blue-400/30">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Restoring audio & video connection...</span>
        </div>
      )}

      {/* AUTOPLAY BLOCKED BANNER (If mobile browser paused media) */}
      {autoplayBlocked && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold text-slate-950 shadow-2xl flex items-center gap-2 animate-bounce border border-amber-400/40">
          <Play className="w-4 h-4 fill-current" />
          <button type="button" onClick={handleUserGestureResume} className="underline">
            Tap to resume media playback
          </button>
        </div>
      )}

      {/* TOP IN-CALL BAR */}
      <header className="h-12 sm:h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 pt-safe">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="relative h-6 w-20">
            <Image src="/assets/jummp-logo.png" alt="JUMMP" fill priority className="object-contain object-left" />
          </Link>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <button
            type="button"
            onClick={copyMeetingLink}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            title="Tap to copy link"
          >
            <span>{meetingId}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowQrModal(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800/80 hover:bg-blue-600/20 hover:text-blue-400 text-xs text-slate-400 transition-colors"
            title="Show QR Code"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[10px] font-medium">QR</span>
          </button>
          {isHost && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Host
            </span>
          )}

          {/* Active Recording Indicator: Host sees controls, Guests see notification badge */}
          {(isRecording || isRoomRecording) && (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-red-950/80 border border-red-500/40 text-red-300 px-2.5 py-1 rounded-xl shadow-md text-xs animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {isHost && isRecording ? (
                <>
                  <span className="font-mono font-bold tracking-wider text-[11px] sm:text-xs">
                    REC {isPausedRecording ? '(PAUSED)' : formatTimer(recordingSeconds)}
                  </span>
                  {isPausedRecording ? (
                    <button
                      type="button"
                      onClick={resumeBrowserRecording}
                      className="p-1 rounded-md bg-red-900/60 hover:bg-red-800 text-white transition-colors"
                      title="Resume recording"
                    >
                      <Play className="w-2.5 h-2.5 fill-white" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={pauseBrowserRecording}
                      className="p-1 rounded-md bg-red-900/60 hover:bg-red-800 text-white transition-colors"
                      title="Pause recording"
                    >
                      <Pause className="w-2.5 h-2.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopBrowserRecording}
                    className="p-1 rounded-md bg-red-600 hover:bg-red-500 text-white transition-colors"
                    title="Stop and save recording"
                  >
                    <Square className="w-2.5 h-2.5 fill-white" />
                  </button>
                </>
              ) : (
                <span className="font-bold tracking-wider text-[11px] sm:text-xs">
                  REC • {recordingBy} is recording
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActivePanel(activePanel === 'notes' ? null : 'notes');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              activePanel === 'notes'
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/40'
                : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white shadow-sm'
            }`}
            title="Open Live Notes & Transcripts"
          >
            <FileText className={`w-3.5 h-3.5 ${activePanel === 'notes' ? 'text-white' : 'text-blue-400'}`} />
            <span>Notes</span>
            {meetingNotes.length > 1 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-500/25 text-[10px] font-mono font-bold text-blue-300">
                {meetingNotes.length - 1}
              </span>
            )}
          </button>

          <span className="font-mono ml-1 text-slate-400">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {/* MAIN VIDEO STAGE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Canvas Container */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 flex flex-col justify-center items-center relative overflow-hidden">
          {/* FLOATING HOST KNOCK BANNER */}
          {isHost && pendingRequests.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-3 animate-in slide-in-from-top-4 duration-200">
              <div className="bg-slate-900/95 backdrop-blur-xl border border-blue-500/50 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] text-slate-400 font-medium">Someone wants to join</div>
                    <div className="text-xs sm:text-sm font-bold text-white truncate">{pendingRequests[0].name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDenyGuest(pendingRequests[0])}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdmitGuest(pendingRequests[0])}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/30"
                  >
                    Admit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GOOGLE MEET INACTIVITY WATCHDOG MODAL: "Are you still here?" */}
          {showStillHereModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="max-w-sm w-full bg-slate-900/98 border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl shadow-amber-500/10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto animate-pulse">
                  <Clock className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Inactivity Warning</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight">Are you still in the meeting?</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    You&apos;ve been the only participant in this call for 10 minutes. To save bandwidth and battery, this room will end automatically in:
                  </p>
                  <div className="pt-2">
                    <span className="text-3xl font-mono font-extrabold text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-2xl border border-amber-500/20 inline-block shadow-inner">
                      {stillHereCountdown}s
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleStayInMeeting}
                    className="w-full py-3 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-95 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>I&apos;m still here (Stay in call)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLeaveCall}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4 text-red-400" />
                    <span>Leave call now</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN SHARE COLLISION ERROR BANNER */}
          {screenShareError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500/95 backdrop-blur-md text-slate-950 font-bold text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-amber-400 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-slate-950" />
              <span>{screenShareError}</span>
            </div>
          )}

          {/* GOOGLE MEET / APPLE FLOATING TOAST NOTIFICATION */}
          {toastNotification && (
            <div
              onClick={() => {
                if (toastNotification.type === 'chat') {
                  setActivePanel('chat');
                  setUnreadChat(false);
                }
                setToastNotification(null);
              }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-auto px-4 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl flex items-center gap-3 text-xs text-white cursor-pointer hover:bg-slate-800/95 transition-all animate-in fade-in slide-in-from-top-3 duration-200"
            >
              <div className="w-7 h-7 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                {toastNotification.type === 'chat' ? (
                  <MessageSquare className="w-3.5 h-3.5" />
                ) : (
                  <Users className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="truncate">
                <span className="font-bold text-white mr-1.5">{toastNotification.title}:</span>
                <span className="text-slate-300 truncate">{toastNotification.subtitle}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToastNotification(null);
                }}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>
          )}

          {Boolean(activeScreenSharer) ? (
            /* ========================================================= */
            /* GOOGLE MEET STYLE SIDE-BY-SIDE PRESENTATION STAGE */
            /* ========================================================= */
            <div className="flex-1 w-full h-full flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-hidden p-1 sm:p-2">
              {/* Left/Center Stage: Screen Presentation */}
              <div className="flex-1 h-full min-h-[300px] bg-slate-950 rounded-2xl sm:rounded-3xl border border-slate-800 relative overflow-hidden shadow-2xl flex items-center justify-center">
                {activeScreenSharer === (userName || (isHost ? 'Host' : 'Guest')) ? (
                  /* THIS USER IS THE PRESENTER */
                  showScreenPreview ? (
                    <>
                      <video
                        ref={screenShareVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain bg-black"
                      />
                      {/* Top Overlay Bar */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 shadow-lg flex items-center gap-2 pointer-events-auto">
                          <MonitorUp className="w-4 h-4 text-blue-400" />
                          <span>You are presenting to everyone</span>
                        </div>
                        <div className="flex items-center gap-2 pointer-events-auto">
                          <button
                            type="button"
                            onClick={() => setShowScreenPreview(false)}
                            className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md border border-white/10 transition-colors"
                          >
                            Hide preview (avoid mirror)
                          </button>
                          <button
                            type="button"
                            onClick={toggleScreenShare}
                            className="bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-lg border border-red-500/30 transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop presenting</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Google Meet Presenter Card (Prevents recursive mirror loop) */
                    <div className="flex flex-col items-center justify-center text-center p-6 sm:p-10 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-w-lg">
                      <div className="w-20 h-20 rounded-3xl bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-[#0b5cff] shadow-xl shadow-blue-500/10">
                        <MonitorUp className="w-10 h-10 animate-pulse" />
                      </div>

                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                          <span>Presentation Live</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                          You&apos;re presenting to everyone
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
                          Your screen is being broadcasted live to everyone in this call.
                        </p>
                        <p className="text-[11px] text-slate-500">
                          To avoid an infinite mirror effect, your screen view is minimized here.
                        </p>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <button
                          type="button"
                          onClick={toggleScreenShare}
                          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all border border-red-500/50"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop presenting</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowScreenPreview(true)}
                          className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
                        >
                          Show video preview
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* REMOTE USER IS VIEWING THE PRESENTATION */
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    {remoteScreenStream ? (
                      <video
                        ref={(el) => {
                          remoteScreenVideoRef.current = el;
                          if (el && remoteScreenStream) {
                            el.defaultMuted = true;
                            el.muted = true;
                            if (el.srcObject !== remoteScreenStream) {
                              el.srcObject = remoteScreenStream;
                            }
                            el.play().catch(() => {});
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={(e) => {
                          (e.target as HTMLVideoElement).play().catch(() => {});
                        }}
                        onCanPlay={(e) => {
                          (e.target as HTMLVideoElement).play().catch(() => {});
                        }}
                        className="w-full h-full object-contain bg-black"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                          <MonitorUp className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-lg font-bold text-white">{activeScreenSharer} is presenting</h4>
                          <p className="text-xs text-slate-400">Connecting screen presentation feed...</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white border border-white/10 shadow-lg flex items-center gap-2 pointer-events-auto">
                      <MonitorUp className="w-4 h-4 text-blue-400 animate-pulse" />
                      <span>{activeScreenSharer} is presenting</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Sidebar: Participant Video Feeds */}
              <div className="w-full lg:w-72 xl:w-80 flex lg:flex-col flex-row gap-2.5 overflow-x-auto lg:overflow-y-auto shrink-0 max-h-full">
                {/* Local User Self-View Tile */}
                <div className="relative w-48 sm:w-60 lg:w-full aspect-video rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                  {camEnabled ? (
                    <video
                      data-self-video="true"
                      ref={bindLocalVideo}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white text-lg font-bold flex items-center justify-center shadow-lg">
                      {userName ? userName.slice(0, 2).toUpperCase() : 'YOU'}
                    </div>
                  )}
                  {handRaised && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-slate-950 p-1 rounded-lg shadow-md animate-bounce z-10 flex items-center gap-1 font-bold text-[10px]">
                      <Hand className="w-3 h-3" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[11px] font-medium border border-white/10">
                    <span>{userName || 'You'} (You)</span>
                    {!micEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                  </div>
                </div>

                {/* Other Remote Participants */}
                {otherParticipants.map((participant) => {
                  const isSharer = participant.name === activeScreenSharer;
                  const remoteStream =
                    remoteStreams[participant.name] ||
                    remoteStreams[participant.name.trim()] ||
                    Object.entries(remoteStreams).find(
                      ([k]) => k.trim().toLowerCase() === participant.name.trim().toLowerCase()
                    )?.[1];
                  const isAudioMuted = participant.audioEnabled === false || Boolean(locallyMutedAudio[participant.name]);
                  const isVideoStopped = participant.videoEnabled === false || Boolean(locallyMutedVideo[participant.name]);

                  return (
                    <div
                      key={participant.id}
                      className="relative w-48 sm:w-60 lg:w-full aspect-video rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-md shrink-0 flex items-center justify-center group"
                    >
                      {remoteStream && !isVideoStopped ? (
                        <>
                          <video
                            autoPlay
                            playsInline
                            muted={isAudioMuted}
                            className="w-full h-full object-cover"
                            ref={(el) => {
                              if (el) {
                                el.defaultMuted = isAudioMuted;
                                el.muted = isAudioMuted;
                                if (el.srcObject !== remoteStream) {
                                  el.srcObject = remoteStream;
                                }
                                el.play().catch(() => {});
                              }
                            }}
                          />
                          {isSharer && (
                            <div className="absolute top-2 left-2 bg-blue-600/90 backdrop-blur-md text-white px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-md z-10 border border-white/20">
                              <MonitorUp className="w-3 h-3 animate-pulse" />
                              <span>Presenting</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white text-base font-bold flex items-center justify-center shadow-lg">
                            {participant.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">{participant.name}</span>
                          {isSharer && (
                            <div className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-semibold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full mt-0.5">
                              <MonitorUp className="w-2.5 h-2.5" />
                              <span>Presenting</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Top-Left Hand Raised Overlay */}
                      {participant.handRaised && (
                        <div className="absolute top-2 left-2 bg-amber-500 text-slate-950 p-1 rounded-lg shadow-md animate-bounce z-10 flex items-center gap-1 font-bold text-[10px]">
                          <Hand className="w-3 h-3" />
                        </div>
                      )}

                      {/* Top-Right Quick Action Overlays */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10 bg-slate-950/80 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleMuteParticipantAudio(participant.name)}
                          className={`p-1 rounded-md transition-all active:scale-95 ${
                            isAudioMuted
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                          title={isAudioMuted ? 'Unmute sound for you' : isHost ? `Mute ${participant.name}` : `Mute ${participant.name} for you`}
                        >
                          {isAudioMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStopParticipantVideo(participant.name)}
                          className={`p-1 rounded-md transition-all active:scale-95 ${
                            isVideoStopped
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                          title={isVideoStopped ? 'Show video' : isHost ? `Stop ${participant.name}'s video` : `Hide ${participant.name}'s video for you`}
                        >
                          {isVideoStopped ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                        </button>
                      </div>

                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[11px] font-medium border border-white/10">
                        <span>{participant.name}</span>
                        {participant.isHost && (
                          <span className="text-[9px] text-blue-400 font-bold uppercase">Host</span>
                        )}
                        {isAudioMuted && <MicOff className="w-3 h-3 text-red-400" />}
                        {isVideoStopped && <VideoOff className="w-3 h-3 text-amber-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* DYNAMIC JUMMP MEET LANDSCAPE PARTICIPANT GRID */
            /* ========================================================= */
            <div className="w-full h-full flex-1 flex items-center justify-center overflow-hidden p-1 sm:p-2">
              {/* Case 1: Solo Mode */}
              {otherParticipants.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
                  <div
                    className={`relative w-full max-w-4xl aspect-video max-h-[75vh] rounded-2xl sm:rounded-3xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-300 ${
                      micEnabled && audioVolume > 15
                        ? 'border-blue-500 ring-2 ring-[#0b5cff] shadow-blue-500/25'
                        : 'border-slate-800/80'
                    }`}
                  >
                    {camEnabled ? (
                      <video
                        data-self-video="true"
                        ref={bindLocalVideo}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-blue-600 text-white text-3xl font-bold flex items-center justify-center shadow-2xl">
                        {userName ? userName.slice(0, 2).toUpperCase() : 'YOU'}
                      </div>
                    )}

                    {/* Bottom Tag with Active Voice Wave */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 shadow-lg">
                      <span>{userName || 'You'} (You)</span>
                      {!micEnabled ? (
                        <span className="p-1 rounded-md bg-red-500/20 text-red-400">
                          <MicOff className="w-3 h-3" />
                        </span>
                      ) : audioVolume > 15 ? (
                        <div className="flex items-end gap-0.5 h-3 ml-0.5">
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-1" />
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-2" />
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-3" />
                        </div>
                      ) : null}
                    </div>

                    {/* Waiting Banner for Solo User */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl text-xs text-slate-200 flex items-center gap-2.5 shadow-xl">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Waiting for others to join</span>
                      <button
                        type="button"
                        onClick={copyMeetingLink}
                        className="ml-1 px-2.5 py-1 rounded-lg bg-[#0b5cff] hover:bg-[#0a75e7] text-white font-bold text-[11px] flex items-center gap-1 transition-colors"
                        title="Copy meeting link"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied' : 'Invite'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 transition-colors border border-white/10"
                        title="Show QR Code"
                      >
                        <QrCode className="w-3 h-3 text-blue-400" />
                        <span>QR</span>
                      </button>
                    </div>

                    {handRaised && (
                      <div className="absolute top-4 right-4 bg-amber-500 text-slate-950 p-2 rounded-xl shadow-lg animate-bounce">
                        <Hand className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>
              ) : otherParticipants.length === 1 ? (
                /* Case 2: Exactly 2 Participants (1 Remote + 1 Local) - Fullscreen Landscape Stage */
                <div className="w-full h-full flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 w-full max-w-[98vw] 2xl:max-w-[99vw] mx-auto p-1 sm:p-2">
                  {/* Local User Tile */}
                  <div
                    className={`relative w-full aspect-video max-h-[76vh] sm:max-h-[85vh] xl:max-h-[88vh] rounded-2xl sm:rounded-3xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-500 ease-out ${
                      isLocalDominant
                        ? 'sm:flex-[1.9] lg:flex-[2.3] scale-[1.01] border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40 ring-offset-2 ring-offset-slate-950 z-10'
                        : dominantSpeaker
                        ? 'sm:flex-[1] scale-[0.98] border-slate-800/80 shadow-lg opacity-90'
                        : isLocalSpeaking
                        ? 'sm:flex-1 border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40'
                        : 'sm:flex-1 border-slate-800/80 shadow-xl'
                    }`}
                  >
                    {camEnabled ? (
                      <video
                        data-self-video="true"
                        ref={bindLocalVideo}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : (
                      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-blue-600 text-white text-2xl sm:text-4xl font-bold flex items-center justify-center shadow-2xl">
                        {userName ? userName.slice(0, 2).toUpperCase() : 'YOU'}
                      </div>
                    )}

                    {/* Top-Left Active Speaking Pill Badge */}
                    {isLocalSpeaking && (
                      <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg border border-blue-400/40 z-20 animate-pulse">
                        <div className="flex items-end gap-0.5 h-3">
                          <span className="w-1 bg-white rounded-full animate-voice-bar-1" />
                          <span className="w-1 bg-white rounded-full animate-voice-bar-2" />
                          <span className="w-1 bg-white rounded-full animate-voice-bar-3" />
                        </div>
                        <span>Speaking</span>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 shadow-md">
                      <span>{userName || 'You'}</span>
                      {!micEnabled ? (
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                      ) : isLocalSpeaking ? (
                        <div className="flex items-end gap-0.5 h-3 ml-0.5">
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-1" />
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-2" />
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-3" />
                        </div>
                      ) : null}
                    </div>
                    {handRaised && (
                      <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 p-1.5 rounded-xl shadow-md animate-bounce">
                        <Hand className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Remote Participant Tile */}
                  {otherParticipants.map((participant) => {
                    const remoteStream =
                      remoteStreams[participant.name] ||
                      remoteStreams[participant.name.trim()] ||
                      Object.entries(remoteStreams).find(
                        ([k]) => k.trim().toLowerCase() === participant.name.trim().toLowerCase()
                      )?.[1];
                    const isAudioMuted = participant.audioEnabled === false || Boolean(locallyMutedAudio[participant.name]);
                    const isVideoStopped = participant.videoEnabled === false || Boolean(locallyMutedVideo[participant.name]);
                    const isRemoteSpeaking = activeSpeakers.has(participant.name.trim().toLowerCase());
                    const isThisRemoteDominant = dominantSpeaker === participant.name.trim().toLowerCase();

                    return (
                      <div
                        key={participant.id}
                        className={`relative w-full aspect-video max-h-[76vh] sm:max-h-[85vh] xl:max-h-[88vh] rounded-2xl sm:rounded-3xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center group transition-all duration-500 ease-out ${
                          isThisRemoteDominant
                            ? 'sm:flex-[1.9] lg:flex-[2.3] scale-[1.01] border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40 ring-offset-2 ring-offset-slate-950 z-10'
                            : dominantSpeaker
                            ? 'sm:flex-[1] scale-[0.98] border-slate-800/80 shadow-lg opacity-90'
                            : isRemoteSpeaking
                            ? 'sm:flex-1 border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40'
                            : 'sm:flex-1 border-slate-800/80 shadow-xl'
                        }`}
                      >
                        {remoteStream && !isVideoStopped ? (
                          <video
                            autoPlay
                            playsInline
                            muted={isAudioMuted}
                            className="w-full h-full object-cover"
                            ref={(el) => {
                              if (el && el.srcObject !== remoteStream) {
                                el.srcObject = remoteStream;
                                el.play().catch(() => {});
                              }
                              if (el) {
                                el.muted = isAudioMuted;
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-indigo-600 text-white text-2xl sm:text-4xl font-bold flex items-center justify-center shadow-2xl">
                              {participant.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              {isVideoStopped ? (
                                <>
                                  <VideoOff className="w-4 h-4 text-amber-400" />
                                  <span className="text-amber-300/80">Camera off</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Connected</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Top-Left Active Speaking Pill Badge */}
                        {isRemoteSpeaking && (
                          <div className={`absolute ${participant.handRaised ? 'top-12' : 'top-3'} left-3 bg-blue-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg border border-blue-400/40 z-20 animate-pulse`}>
                            <div className="flex items-end gap-0.5 h-3">
                              <span className="w-1 bg-white rounded-full animate-voice-bar-1" />
                              <span className="w-1 bg-white rounded-full animate-voice-bar-2" />
                              <span className="w-1 bg-white rounded-full animate-voice-bar-3" />
                            </div>
                            <span>Speaking</span>
                          </div>
                        )}

                        {/* Top-Left Hand Raised Overlay */}
                        {participant.handRaised && (
                          <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 px-2.5 py-1.5 rounded-xl shadow-lg animate-bounce z-10 flex items-center gap-1.5 font-bold text-xs border border-amber-400/50">
                            <Hand className="w-4 h-4" />
                            <span>Hand raised</span>
                          </div>
                        )}

                        {/* Top-Right Quick Action Overlays */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMuteParticipantAudio(participant.name)}
                            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                              isAudioMuted
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                            title={isAudioMuted ? 'Unmute sound for you' : isHost ? `Mute ${participant.name}` : `Mute ${participant.name} for you`}
                          >
                            {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStopParticipantVideo(participant.name)}
                            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                              isVideoStopped
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                            title={isVideoStopped ? 'Show video' : isHost ? `Stop ${participant.name}'s video` : `Hide ${participant.name}'s video for you`}
                          >
                            {isVideoStopped ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 shadow-md">
                          <span>{participant.name}</span>
                          {participant.isHost && (
                            <span className="text-[10px] text-blue-400 font-bold uppercase">Host</span>
                          )}
                          {isRemoteSpeaking && !isAudioMuted && (
                            <div className="flex items-end gap-0.5 h-3 ml-0.5">
                              <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-1" />
                              <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-2" />
                              <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-3" />
                            </div>
                          )}
                          {isAudioMuted && (
                            <span className="p-0.5 rounded bg-red-500/20 text-red-400" title="Microphone muted">
                              <MicOff className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {isVideoStopped && (
                            <span className="p-0.5 rounded bg-amber-500/20 text-amber-400" title="Camera off">
                              <VideoOff className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Case 3: 3+ Participants - Responsive Dynamic Active-Speaker Grid */
                <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-[98vw] 2xl:max-w-[99vw] mx-auto items-center justify-center overflow-y-auto p-1 sm:p-2">
                  {/* Local User Tile */}
                  <div
                    className={`relative w-full aspect-video rounded-2xl sm:rounded-3xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-500 ease-out ${
                      isLocalDominant
                        ? 'order-first sm:col-span-2 sm:row-span-2 min-h-[360px] sm:min-h-[460px] xl:min-h-[520px] max-h-[75vh] border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40 ring-offset-2 ring-offset-slate-950 z-10 scale-[1.01]'
                        : dominantSpeaker
                        ? 'sm:col-span-1 max-h-[40vh] border-slate-800/80 shadow-md opacity-90 scale-[0.98]'
                        : isLocalSpeaking
                        ? 'sm:col-span-1 max-h-[44vh] sm:max-h-[48vh] xl:max-h-[52vh] border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40'
                        : 'sm:col-span-1 max-h-[44vh] sm:max-h-[48vh] xl:max-h-[52vh] border-slate-800/80 shadow-xl'
                    }`}
                  >
                    {camEnabled ? (
                      <video
                        data-self-video="true"
                        ref={bindLocalVideo}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white text-xl font-bold flex items-center justify-center shadow-lg">
                        {userName ? userName.slice(0, 2).toUpperCase() : 'YOU'}
                      </div>
                    )}

                    {/* Top-Left Active Speaking Pill Badge */}
                    {isLocalSpeaking && (
                      <div className="absolute top-2.5 left-2.5 bg-blue-600/90 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-lg border border-blue-400/40 z-20 animate-pulse">
                        <div className="flex items-end gap-0.5 h-2.5">
                          <span className="w-1 bg-white rounded-full animate-voice-bar-1" />
                          <span className="w-1 bg-white rounded-full animate-voice-bar-2" />
                          <span className="w-1 bg-white rounded-full animate-voice-bar-3" />
                        </div>
                        <span>Speaking</span>
                      </div>
                    )}

                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-semibold border border-white/10 shadow-md">
                      <span>{userName || 'You'}</span>
                      {!micEnabled ? (
                        <MicOff className="w-3 h-3 text-red-400" />
                      ) : isLocalSpeaking ? (
                        <div className="flex items-end gap-0.5 h-2.5">
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-1" />
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-2" />
                          <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-3" />
                        </div>
                      ) : null}
                    </div>
                    {handRaised && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-500 text-slate-950 p-1.5 rounded-xl shadow-md animate-bounce">
                        <Hand className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Remote Participant Tiles */}
                  {otherParticipants.map((participant) => {
                    const remoteStream =
                      remoteStreams[participant.name] ||
                      remoteStreams[participant.name.trim()] ||
                      Object.entries(remoteStreams).find(
                        ([k]) => k.trim().toLowerCase() === participant.name.trim().toLowerCase()
                      )?.[1];
                    const isAudioMuted = participant.audioEnabled === false || Boolean(locallyMutedAudio[participant.name]);
                    const isVideoStopped = participant.videoEnabled === false || Boolean(locallyMutedVideo[participant.name]);
                    const isRemoteSpeaking = activeSpeakers.has(participant.name.trim().toLowerCase());
                    const isThisRemoteDominant = dominantSpeaker === participant.name.trim().toLowerCase();

                    return (
                      <div
                        key={participant.id}
                        className={`relative w-full aspect-video rounded-2xl sm:rounded-3xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center group transition-all duration-500 ease-out ${
                          isThisRemoteDominant
                            ? 'order-first sm:col-span-2 sm:row-span-2 min-h-[360px] sm:min-h-[460px] xl:min-h-[520px] max-h-[75vh] border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40 ring-offset-2 ring-offset-slate-950 z-10 scale-[1.01]'
                            : dominantSpeaker
                            ? 'sm:col-span-1 max-h-[40vh] border-slate-800/80 shadow-md opacity-90 scale-[0.98]'
                            : isRemoteSpeaking
                            ? 'sm:col-span-1 max-h-[44vh] sm:max-h-[48vh] xl:max-h-[52vh] border-blue-400 ring-4 ring-[#0b5cff] shadow-2xl shadow-blue-500/40'
                            : 'sm:col-span-1 max-h-[44vh] sm:max-h-[48vh] xl:max-h-[52vh] border-slate-800/80 shadow-xl'
                        }`}
                      >
                        {remoteStream && !isVideoStopped ? (
                          <video
                            autoPlay
                            playsInline
                            muted={isAudioMuted}
                            className="w-full h-full object-cover"
                            ref={(el) => {
                              if (el && el.srcObject !== remoteStream) {
                                el.srcObject = remoteStream;
                                el.play().catch(() => {});
                              }
                              if (el) {
                                el.muted = isAudioMuted;
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white text-xl font-bold flex items-center justify-center shadow-lg">
                              {participant.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              {isVideoStopped ? (
                                <>
                                  <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="text-amber-300/80">Camera off</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Connected</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Top-Left Active Speaking Pill Badge */}
                        {isRemoteSpeaking && (
                          <div className={`absolute ${participant.handRaised ? 'top-10' : 'top-2.5'} left-2.5 bg-blue-600/90 backdrop-blur-md text-white px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-lg border border-blue-400/40 z-20 animate-pulse`}>
                            <div className="flex items-end gap-0.5 h-2.5">
                              <span className="w-1 bg-white rounded-full animate-voice-bar-1" />
                              <span className="w-1 bg-white rounded-full animate-voice-bar-2" />
                              <span className="w-1 bg-white rounded-full animate-voice-bar-3" />
                            </div>
                            <span>Speaking</span>
                          </div>
                        )}

                        {/* Top-Left Hand Raised Overlay */}
                        {participant.handRaised && (
                          <div className="absolute top-2.5 left-2.5 bg-amber-500 text-slate-950 px-2.5 py-1.5 rounded-xl shadow-lg animate-bounce z-10 flex items-center gap-1.5 font-bold text-xs border border-amber-400/50">
                            <Hand className="w-4 h-4" />
                            <span>Hand raised</span>
                          </div>
                        )}

                        {/* Top-Right Quick Action Overlays */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10 bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMuteParticipantAudio(participant.name)}
                            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                              isAudioMuted
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                            title={isAudioMuted ? 'Unmute sound for you' : isHost ? `Mute ${participant.name}` : `Mute ${participant.name} for you`}
                          >
                            {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStopParticipantVideo(participant.name)}
                            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
                              isVideoStopped
                                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                            title={isVideoStopped ? 'Show video' : isHost ? `Stop ${participant.name}'s video` : `Hide ${participant.name}'s video for you`}
                          >
                            {isVideoStopped ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-medium border border-white/10">
                          <span>{participant.name}</span>
                          {participant.isHost && (
                            <span className="text-[10px] text-blue-400 font-bold uppercase">Host</span>
                          )}
                          {isRemoteSpeaking && !isAudioMuted && (
                            <div className="flex items-end gap-0.5 h-2.5 ml-0.5">
                              <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-1" />
                              <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-2" />
                              <span className="w-1 bg-emerald-400 rounded-full animate-voice-bar-3" />
                            </div>
                          )}
                          {isAudioMuted && (
                            <span className="p-0.5 rounded bg-red-500/20 text-red-400" title="Microphone muted">
                              <MicOff className="w-3 h-3" />
                            </span>
                          )}
                          {isVideoStopped && (
                            <span className="p-0.5 rounded bg-amber-500/20 text-amber-400" title="Camera off">
                              <VideoOff className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Floating Emoji Reactions Stream */}
          <div className="absolute bottom-8 right-6 pointer-events-none flex flex-col items-center z-40">
            {floatingReactions.map((r) => (
              <span key={r.id} className="text-4xl animate-float-up opacity-95">
                {r.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* SIDE DRAWER (Desktop) or SLIDE-UP BOTTOM SHEET (Mobile) */}
        {activePanel && (
          <>
            {/* Mobile Backdrop Overlay (Tap to dismiss) */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden animate-in fade-in duration-200"
              onClick={() => {
                triggerHaptic('light');
                setActivePanel(null);
              }}
            />

            <aside
              style={{
                transform: sheetOffsetY > 0 ? `translateY(${sheetOffsetY}px)` : undefined,
                transition: sheetOffsetY === 0 ? 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
              }}
              className={`
                fixed inset-x-0 bottom-0 z-50 sm:relative sm:inset-auto sm:w-[380px] lg:w-[420px] sm:max-w-[440px] sm:h-auto shrink-0
                bg-slate-950/98 sm:bg-slate-900/98 backdrop-blur-2xl border-t sm:border-t-0 sm:border-l border-slate-800 
                flex flex-col rounded-t-3xl sm:rounded-none max-h-[85vh] sm:max-h-full shadow-2xl 
                sheet-spring-up sm:animate-in sm:slide-in-from-right duration-250 pb-safe touch-scroll-smooth overflow-hidden
              `}
            >
              {/* Mobile Drag Indicator (Touch Gesture Dismiss) */}
              <div
                className="w-full pt-3 pb-1 cursor-grab active:cursor-grabbing sm:hidden touch-none"
                onTouchStart={handleSheetTouchStart}
                onTouchMove={handleSheetTouchMove}
                onTouchEnd={handleSheetTouchEnd}
              >
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto" />
              </div>

              {/* Google Meet Unified Top Tab Bar */}
              <div className="px-3 pt-2 sm:pt-3 pb-2 border-b border-slate-800 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setActivePanel('chat');
                      setUnreadChat(false);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      activePanel === 'chat'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                    {unreadChat && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setActivePanel('people');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      activePanel === 'people'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>People</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 font-mono">
                      {1 + otherParticipants.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setActivePanel('notes');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                      activePanel === 'notes'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Notes</span>
                    {meetingNotes.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 font-mono">
                        {meetingNotes.length - 1}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setActivePanel('info');
                    }}
                    className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activePanel === 'info'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                    title="Meeting Details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActivePanel(null);
                  }}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* PEOPLE TAB */}
              {activePanel === 'people' && (
                <div className="space-y-4">
                  {/* Host Admission Queue */}
                  {isHost && pendingRequests.length > 0 && (
                    <div className="space-y-2 p-3 rounded-2xl bg-blue-950/40 border border-blue-600/40 animate-in fade-in">
                      <div className="font-bold text-blue-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>Admission Requests ({pendingRequests.length})</span>
                      </div>
                      {pendingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                        >
                          <span className="font-semibold text-white truncate mr-2">{req.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAdmitGuest(req)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                            >
                              Admit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDenyGuest(req)}
                              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Participants List with Moderation Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                        In Call ({1 + otherParticipants.length})
                      </div>
                      {isHost && otherParticipants.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleMuteAllAudio}
                            className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-semibold text-[10px] flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                            title="Mute microphones for all participants"
                          >
                            <MicOff className="w-3 h-3 text-red-400" />
                            <span>Mute all</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleStopAllVideo}
                            className="px-2 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-semibold text-[10px] flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                            title="Turn off video cameras for all participants"
                          >
                            <VideoOff className="w-3 h-3 text-amber-400" />
                            <span>Stop all video</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Local User Tile in People List */}
                    <div className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-800/60 bg-slate-900/60 border border-slate-800">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                          {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-white truncate">{userName || 'You'} (You)</div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                            <span>{isHost ? 'Meeting Host' : 'Participant'}</span>
                            {handRaised && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                                <Hand className="w-2.5 h-2.5" /> Hand raised
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                        {handRaised && (
                          <span className="p-1 rounded-md bg-amber-500/20 text-amber-400" title="Hand raised">
                            <Hand className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {!micEnabled ? (
                          <MicOff className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {!camEnabled && (
                          <VideoOff className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                    </div>

                    {/* Remote Participants */}
                    {otherParticipants.map((p) => {
                      const isAudioMuted = p.audioEnabled === false || Boolean(locallyMutedAudio[p.name]);
                      const isVideoStopped = p.videoEnabled === false || Boolean(locallyMutedVideo[p.name]);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-800/60 bg-slate-900/30 border border-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="font-semibold text-slate-200 truncate">{p.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span>{p.isHost ? 'Host' : 'Guest'}</span>
                                {p.handRaised && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                                    <Hand className="w-2.5 h-2.5" /> Raised
                                  </span>
                                )}
                                {isAudioMuted && <span className="text-red-400 font-medium">• Muted</span>}
                                {isVideoStopped && <span className="text-amber-400 font-medium">• Video off</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {p.handRaised && (
                              <span className="p-1 rounded-md bg-amber-500/20 text-amber-400" title="Hand raised">
                                <Hand className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {/* Mute / Unmute Audio Button */}
                            <button
                              type="button"
                              onClick={() => handleMuteParticipantAudio(p.name)}
                              className={`p-1.5 rounded-xl border transition-all active:scale-95 ${
                                isAudioMuted
                                  ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                                  : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
                              }`}
                              title={
                                isAudioMuted
                                  ? 'Unmute sound for you'
                                  : isHost
                                  ? `Mute ${p.name}'s microphone`
                                  : `Mute ${p.name}'s sound for you`
                              }
                            >
                              {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                            </button>

                            {/* Stop / Show Video Button */}
                            <button
                              type="button"
                              onClick={() => handleStopParticipantVideo(p.name)}
                              className={`p-1.5 rounded-xl border transition-all active:scale-95 ${
                                isVideoStopped
                                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                                  : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
                              }`}
                              title={
                                isVideoStopped
                                  ? 'Show video'
                                  : isHost
                                  ? `Stop ${p.name}'s video camera`
                                  : `Hide ${p.name}'s video for you`
                              }
                            >
                              {isVideoStopped ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CHAT TAB - Apple iMessage / Google Meet Refined Style */}
              {activePanel === 'chat' && (
                <div className="h-full flex flex-col justify-between space-y-3">
                  <div className="space-y-3 overflow-y-auto max-h-[46vh] sm:max-h-[62vh] pr-1">
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-10 space-y-2 text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
                        <p className="font-semibold text-slate-300">No messages yet</p>
                        <p className="text-[11px] text-slate-500">Messages sent here are visible to everyone.</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe =
                          msg.sender === (userName || (isHost ? 'Host' : 'You')) ||
                          msg.sender === 'You';
                        const isBot = msg.sender === 'JUMMP Bot';

                        if (isBot) {
                          return (
                            <div key={msg.id} className="flex justify-center my-2">
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 shadow-sm">
                                <Sparkles className="w-3 h-3 text-blue-400" />
                                <span>{msg.text}</span>
                              </div>
                            </div>
                          );
                        }

                        if (isMe) {
                          return (
                            <div key={msg.id} className="flex flex-col items-end space-y-1">
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mr-1 font-medium">
                                <span>You</span>
                                <span>•</span>
                                <span>{msg.time}</span>
                              </div>
                              <div className="max-w-[85%] bg-gradient-to-br from-[#0b5cff] to-[#0a4ed4] text-white px-3.5 py-2 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-md shadow-blue-500/10 break-words selection:bg-white/30">
                                {msg.text}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className="flex flex-col items-start space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 ml-1 font-medium">
                              <span className="font-bold text-blue-300">{msg.sender}</span>
                              <span>•</span>
                              <span>{msg.time}</span>
                            </div>
                            <div className="max-w-[85%] bg-slate-800/90 text-slate-100 px-3.5 py-2 rounded-2xl rounded-tl-sm text-xs leading-relaxed border border-white/5 break-words shadow-sm">
                              {msg.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input Container */}
                  <div className="pt-2 space-y-2 border-t border-slate-800">
                    {/* Quick Emojis Row */}
                    <div className="flex items-center gap-1.5 px-1">
                      {['👍', '❤️', '👏', '🔥', '😂', '🎉'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setNewChatText((prev) => prev + emoji);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs transition-colors hover:scale-110 active:scale-95"
                          title={`Insert ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendChat();
                      }}
                      className="flex gap-2 items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all"
                    >
                      <input
                        type="text"
                        value={newChatText}
                        onChange={(e) => setNewChatText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChat();
                          }
                        }}
                        placeholder="Send a message to everyone..."
                        className="flex-1 bg-transparent text-xs px-3 py-1.5 text-white outline-none placeholder:text-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={!newChatText.trim()}
                        className={`p-2 rounded-xl text-white transition-all ${
                          newChatText.trim()
                            ? 'bg-[#0b5cff] hover:bg-[#0a75e7] shadow-md shadow-blue-500/25 active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                        title="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* INFO TAB */}
              {activePanel === 'info' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-white mb-1">Meeting Details</h4>
                    <p className="text-slate-400 text-xs">Share this link or QR code to invite others to join.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 font-mono text-[11px] break-all text-blue-300 select-all shadow-inner">
                    {getMeetingUrl(meetingId)}
                  </div>

                  {/* Share & Copy Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={copyMeetingLink}
                      className="py-2.5 px-3 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied' : 'Copy link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={shareMeetingQr}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
                      title="Share meeting invitation"
                    >
                      <Share2 className="w-4 h-4 text-blue-400" />
                      <span>Share</span>
                    </button>
                  </div>

                  {/* QR Code Section with Show/Hide and Download JPG */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="font-semibold text-xs text-white">Meeting QR Code</h5>
                          <p className="text-[10px] text-slate-400">Scan on phone to join call</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowInfoQr(!showInfoQr)}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                      >
                        {showInfoQr ? 'Hide QR' : 'Show QR'}
                      </button>
                    </div>

                    {showInfoQr && (
                      <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                        <div className="flex justify-center p-3 rounded-xl bg-white shadow-inner">
                          {qrDataUrl ? (
                            <img
                              src={qrDataUrl}
                              alt={`QR Code for ${meetingId}`}
                              className="w-44 h-44 object-contain rounded"
                            />
                          ) : (
                            <div className="w-44 h-44 flex items-center justify-center text-slate-600 text-xs font-mono">
                              Generating QR...
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={downloadQrJpg}
                            className="w-full py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 hover:border-slate-600 transition-all"
                            title="Download QR code in .jpg format"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Download .JPG</span>
                          </button>
                          <button
                            type="button"
                            onClick={shareMeetingQr}
                            className="w-full py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 hover:border-slate-600 transition-all"
                            title="Share QR code"
                          >
                            <Share2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Share QR</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-2.5 text-slate-400 text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Peer-to-peer encrypted connection active</span>
                  </div>
                </div>
              )}

              {/* NOTES TAB */}
              {activePanel === 'notes' && (
                <div className="flex flex-col h-full space-y-3">
                  {/* Notes Header Bar with Actions */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">Live Meeting Notes</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>AI Speech Recognition Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={copyAllNotes}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Copy all notes to clipboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={downloadNotes}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Download notes as Word document (.doc)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Clear all meeting transcripts and notes?')) {
                            setMeetingNotes([]);
                            setInterimTranscript(null);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-300 transition-colors"
                        title="Clear notes"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Transcripts Stream */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[calc(100vh-300px)] sm:max-h-[50vh]">
                    {meetingNotes.length === 0 && !interimTranscript ? (
                      <div className="text-center py-8 text-slate-500 space-y-2">
                        <FileText className="w-8 h-8 mx-auto opacity-40 text-blue-400" />
                        <p className="text-xs">No notes yet. Start speaking into your mic to see live transcripts.</p>
                      </div>
                    ) : (
                      meetingNotes.map((note) => {
                        const isMe =
                          note.speaker.trim().toLowerCase() ===
                          (userName || (isHost ? 'Host' : 'Guest')).trim().toLowerCase();

                        return (
                          <div
                            key={note.id}
                            className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isMe ? 'bg-blue-400 shadow-xs shadow-blue-400/50' : 'bg-indigo-400 shadow-xs shadow-indigo-400/50'
                                  }`}
                                />
                                <span
                                  className={`font-bold text-xs ${
                                    isMe ? 'text-blue-300' : 'text-indigo-300'
                                  }`}
                                >
                                  {note.speaker}
                                </span>
                                {note.isAutoTranscript && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                                    Spoken
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">{note.time}</span>
                            </div>
                            <div className="text-xs text-slate-200 leading-relaxed font-sans pl-3 border-l-2 border-slate-700/70 break-words whitespace-pre-line">
                              <div className="font-bold text-slate-300 mb-1">{note.speaker} :</div>
                              <div className="text-slate-100 pl-0.5">&ldquo;{formatSpokenText(note.text)}&rdquo;</div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* LIVE INTERIM TRANSCRIPT (Active speaker speaking right now) */}
                    {interimTranscript && (
                      <div className="bg-blue-950/40 rounded-2xl p-3 border border-blue-500/50 animate-pulse shadow-md">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex items-end gap-0.5 h-3">
                              <span className="w-1 bg-blue-400 rounded-full animate-voice-bar-1" />
                              <span className="w-1 bg-blue-400 rounded-full animate-voice-bar-2" />
                              <span className="w-1 bg-blue-400 rounded-full animate-voice-bar-3" />
                            </div>
                            <span className="font-bold text-xs text-blue-300">
                              {interimTranscript.speaker} (Speaking...)
                            </span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/25 text-blue-300 font-semibold uppercase tracking-wider">
                            Live
                          </span>
                        </div>
                        <div className="text-xs text-blue-100 italic leading-relaxed pl-3 border-l-2 border-blue-400/80 break-words whitespace-pre-line">
                          <div className="font-bold text-blue-300 not-italic mb-1">{interimTranscript.speaker} :</div>
                          <div className="pl-0.5 text-blue-100">&ldquo;{formatSpokenText(interimTranscript.text)}&rdquo;</div>
                        </div>
                      </div>
                    )}

                    <div ref={notesEndRef} />
                  </div>

                  {/* Manual Note Add Input */}
                  <form
                    onSubmit={handleAddCustomNote}
                    className="pt-2 border-t border-slate-800 flex gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={newCustomNote}
                      onChange={(e) => setNewCustomNote(e.target.value)}
                      placeholder="Add a custom note or summary..."
                      className="flex-1 bg-slate-900 border border-slate-800 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!newCustomNote.trim()}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        newCustomNote.trim()
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </aside>
        </>
      )}
      </div>

      {/* FLOATING EMOJI REACTIONS PICKER (Mobile & Desktop) */}
      {showReactionsPicker && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-xl px-3 py-2 rounded-full border border-white/15 shadow-2xl flex items-center gap-2 animate-in zoom-in-95 duration-150">
          {['👏', '❤️', '🔥', '🎉', '👍', '😂', '😮'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                triggerReaction(emoji);
                setShowReactionsPicker(false);
              }}
              className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-lg hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* JUMMP MEET FLOATING BOTTOM CONTROL DOCK (Apple-Style Minimalist Dock) */}
      <footer className="h-20 sm:h-22 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-900/90 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 pb-safe">
        {/* Left: Meeting Code */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 select-all">{meetingId}</span>
        </div>

        {/* Center Main Controls Island (Apple-Style Elevated Capsule) */}
        <div className="flex items-center gap-1.5 sm:gap-2 mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/10 p-1.5 sm:p-2 rounded-3xl shadow-2xl shadow-black/40">
          {/* Mic */}
          <div className="relative group">
            <button
              type="button"
              onClick={toggleMic}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all active:scale-95 border ${
                micEnabled
                  ? audioVolume > 15
                    ? 'bg-slate-800 text-white border-emerald-400 ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-white border-white/10'
                  : 'bg-red-600 hover:bg-red-700 text-white border-red-500/50 shadow-lg shadow-red-600/30'
              }`}
            >
              {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              {micEnabled ? 'Mute microphone' : 'Unmute microphone'}
            </span>
          </div>

          {/* Cam */}
          <div className="relative group">
            <button
              type="button"
              onClick={toggleCam}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all active:scale-95 border ${
                camEnabled
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-white border-white/10'
                  : 'bg-red-600 hover:bg-red-700 text-white border-red-500/50 shadow-lg shadow-red-600/30'
              }`}
            >
              {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              {camEnabled ? 'Turn off camera' : 'Turn on camera'}
            </span>
          </div>

          {/* Screen Share */}
          <div className="relative group">
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all active:scale-95 border ${
                isScreenSharing
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-white border-white/10'
              }`}
            >
              <MonitorUp className="w-5 h-5" />
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              {isScreenSharing ? 'Stop presenting' : 'Present screen'}
            </span>
          </div>

          {/* Browser Record Button (Host Only) */}
          {isHost && (
            <div className="relative group">
              <button
                type="button"
                onClick={isRecording ? stopBrowserRecording : startBrowserRecording}
                className={`p-3 sm:p-3.5 rounded-2xl transition-all active:scale-95 border ${
                  isRecording
                    ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-lg shadow-red-600/30'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-white/10'
                }`}
              >
                <Disc className="w-5 h-5" />
              </button>
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
                {isRecording ? 'Stop recording' : 'Record meeting'}
              </span>
            </div>
          )}

          {/* Hand Raise */}
          <div className="relative group">
            <button
              type="button"
              onClick={toggleHandRaise}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all active:scale-95 border ${
                handRaised
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-lg shadow-amber-500/30'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-white border-white/10'
              }`}
            >
              <Hand className="w-5 h-5" />
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              {handRaised ? 'Lower hand' : 'Raise hand'}
            </span>
          </div>

          {/* Emoji Reactions Trigger */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowReactionsPicker(!showReactionsPicker);
              }}
              className={`p-3 sm:p-3.5 rounded-2xl transition-all active:scale-95 border ${
                showReactionsPicker
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-white border-white/10'
              }`}
            >
              <Smile className="w-5 h-5" />
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              Send reaction
            </span>
          </div>

          {/* Leave Call Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={handleLeaveCall}
              className="px-4 sm:px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-1.5 active:scale-95 transition-all border border-red-500/50 ml-1"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline">Leave</span>
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              Leave call
            </span>
          </div>
        </div>

        {/* Right Action Icons (Info / People / Chat) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActivePanel(activePanel === 'info' ? null : 'info');
              }}
              className={`p-2.5 rounded-xl transition-colors ${
                activePanel === 'info'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Info className="w-5 h-5" />
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              Meeting details
            </span>
          </div>

          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActivePanel(activePanel === 'people' ? null : 'people');
              }}
              className={`p-2.5 rounded-xl transition-colors relative ${
                activePanel === 'people'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              {pendingRequests.length > 0 && isHost && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              )}
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              People ({1 + otherParticipants.length})
            </span>
          </div>

          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActivePanel(activePanel === 'chat' ? null : 'chat');
                setUnreadChat(false);
              }}
              className={`p-2.5 rounded-xl transition-colors relative ${
                activePanel === 'chat'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {unreadChat && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#0b5cff] animate-pulse" />
              )}
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              In-call chat
            </span>
          </div>

          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActivePanel(activePanel === 'notes' ? null : 'notes');
              }}
              className={`p-2.5 rounded-xl transition-colors relative ${
                activePanel === 'notes'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5" />
              {meetingNotes.length > 1 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-[9px] font-bold flex items-center justify-center text-white font-mono">
                  {meetingNotes.length - 1 > 9 ? '9+' : meetingNotes.length - 1}
                </span>
              )}
            </button>
            <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[10px] font-medium px-2 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-xl">
              Live Notes & Transcripts
            </span>
          </div>
        </div>
      </footer>

      {/* APPLE-STYLE RECORDING DOWNLOAD MODAL */}
      {showRecordingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-950/95 border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Meeting Recording Ready</h3>
                  <p className="text-xs text-slate-400">Captured locally in your browser (Zero database storage)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRecordingModal}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Video Player Preview */}
            {recordedUrl && (
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner">
                <video src={recordedUrl} controls className="w-full h-full object-contain" />
              </div>
            )}

            {/* EXPLICIT IMMEDIATE DOWNLOAD WARNING BANNER (FREE TIER / NO DB STORAGE) */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 shadow-lg">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                <div className="font-bold text-amber-300 text-xs flex items-center gap-2">
                  <span>Download it right now</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Not Saved In Database
                  </span>
                </div>
                <div className="text-[11px] text-amber-200/90 leading-relaxed">
                  Recordings are held <strong>only temporarily in your device&apos;s browser memory</strong>. They are <strong>never stored in the database or on the server</strong>. Once you close this modal, refresh, or leave the meeting, this recording <strong>will be permanently deleted and will no longer be available</strong>.
                </div>
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                Duration: {formatTimer(recordingSeconds)}
              </span>
              {recordedBlob && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                  {(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                HD WebM Video
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCloseRecordingModal}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              >
                {hasDownloadedRecording ? 'Done' : 'Discard / Close'}
              </button>
              <button
                type="button"
                onClick={downloadRecording}
                className="px-5 py-2.5 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-95 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{hasDownloadedRecording ? 'Download Again' : 'Download Right Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN GLASSMORPHIC QR CODE DIALOG */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close QR modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 text-blue-400 pt-1">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Meeting QR Code</h3>
            </div>

            <p className="text-xs text-slate-400">
              Scan with your phone&apos;s camera to join this room instantly.
            </p>

            {/* QR Card */}
            <div className="p-4 rounded-2xl bg-white shadow-xl flex items-center justify-center mx-auto w-fit">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR for ${meetingId}`}
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-600 text-sm font-medium">
                  Generating QR code...
                </div>
              )}
            </div>

            {/* Meeting Link Badge */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-blue-300 break-all select-all">
              {getMeetingUrl(meetingId)}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={downloadQrJpg}
                className="py-3 px-3 rounded-2xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                title="Download QR in .jpg format"
              >
                <Download className="w-4 h-4" />
                <span>Download .JPG</span>
              </button>

              <button
                type="button"
                onClick={shareMeetingQr}
                className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                title="Share QR Code"
              >
                <Share2 className="w-4 h-4 text-blue-400" />
                <span>Share QR</span>
              </button>
            </div>

            <button
              type="button"
              onClick={copyMeetingLink}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-800/80 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Copy Meeting Link'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetPage({ params }: { params: { meetingId: string } }) {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] bg-slate-950 text-white flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Connecting to JUMMP Meet...</p>
          </div>
        </div>
      }
    >
      <MeetContent params={params} />
    </Suspense>
  );
}
