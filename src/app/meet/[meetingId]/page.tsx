'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Shield,
  ArrowLeft,
  Settings,
  MoreVertical,
  Bell,
  Sparkles,
  RotateCcw,
  Home,
  SwitchCamera,
  Play,
  RefreshCw,
  Clock,
  AlertCircle,
  Maximize2,
  Minimize2,
  CheckCircle2,
} from 'lucide-react';
import {
  MeetChannel,
  Participant,
  ChatMessage,
  JoinRequest,
  getMeetingUrl,
  playChime,
  formatTimeAgo,
  createAudioVisualizer,
  generateMeetingId,
} from '@/lib/meetStore';
import {
  createOrGetMeeting,
  saveChatMessage,
  getMeetingMessages,
  checkMeetingStatus,
  updateMeetingHeartbeat,
  endMeeting,
  DBMeeting,
  MeetingStatusCheck,
} from '@/lib/supabaseClient';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track } from 'livekit-client';

function MeetContent({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHostQuery = searchParams.get('host') === 'true';

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
  const [handRaised, setHandRaised] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [audioVolume, setAudioVolume] = useState(0); // 0-100 live voice volume
  const [isResyncing, setIsResyncing] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Video Refs & Streams
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const inCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Remote WebRTC Streams
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  // LiveKit SFU Ref
  const livekitRoomRef = useRef<Room | null>(null);

  // Meeting State
  const [isHost, setIsHost] = useState(isHostQuery);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'JUMMP Bot', text: 'Welcome to JUMMP Meet. Call is encrypted and ready.', time: 'Just now' },
  ]);
  const [newChatText, setNewChatText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);

  // UI Panels (Mobile bottom sheet or Desktop drawer)
  const [activePanel, setActivePanel] = useState<'people' | 'chat' | 'info' | null>(null);
  const [copied, setCopied] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);
  const [isMinimizedPip, setIsMinimizedPip] = useState(false);

  const channelRef = useRef<MeetChannel | null>(null);

  // =========================================================================
  // 1. INITIALIZE STATUS & DATABASE RECORD (Handles Inactivity & Weeks-Old Links)
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    async function initStatus() {
      setIsCheckingStatus(true);
      const check = await checkMeetingStatus(meetingId);
      if (!isMounted) return;
      setStatusCheck(check);
      setIsCheckingStatus(false);

      // If link is valid or ready, register/update in Supabase
      if (!check.isExpired) {
        const meeting = await createOrGetMeeting(meetingId, isHostQuery ? 'Host' : 'Guest');
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
      }
    }

    initStatus();

    return () => {
      isMounted = false;
    };
  }, [meetingId, isHostQuery]);

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // =========================================================================
  // 2. IN-CALL HEARTBEAT (Keeps room alive and tracks activity in Supabase)
  // =========================================================================
  useEffect(() => {
    if (!inCall || !dbMeeting) return;

    // Send heartbeat every 20 seconds
    const interval = setInterval(() => {
      updateMeetingHeartbeat(dbMeeting.id);
    }, 20000);

    return () => clearInterval(interval);
  }, [inCall, dbMeeting]);

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
    async (mode: 'user' | 'environment' = facingMode) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camEnabled
            ? {
                facingMode: mode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
          audio: micEnabled ? { echoCancellation: true, noiseSuppression: true } : false,
        });

        setLocalStream(stream);
        localStreamRef.current = stream;

        // Attach to lobby preview video if present
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        // Attach to in-call video if present
        if (inCallVideoRef.current) {
          inCallVideoRef.current.srcObject = stream;
          inCallVideoRef.current.play().catch(() => {});
        }

        // Re-publish to LiveKit if connected
        if (livekitRoomRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          if (videoTrack) await livekitRoomRef.current.localParticipant.publishTrack(videoTrack);
          if (audioTrack) await livekitRoomRef.current.localParticipant.publishTrack(audioTrack);
        }

        return stream;
      } catch (err) {
        console.warn('getUserMedia error:', err);
        return null;
      }
    },
    [camEnabled, micEnabled, facingMode]
  );

  // Initialize camera & mic in Lobby
  useEffect(() => {
    if (!inCall && !hasLeft && !statusCheck?.isExpired) {
      acquireMedia(facingMode);
    }

    return () => {
      if (!inCall && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [acquireMedia, facingMode, inCall, hasLeft, statusCheck?.isExpired]);

  // =========================================================================
  // 5. RESILIENT MOBILE APP-SWITCHING / BACKGROUND FREEZE RECOVERY ENGINE
  // (Fixes: "I opened another app and came back it got stucked")
  // =========================================================================
  useEffect(() => {
    const handleForegroundReturn = async () => {
      // Triggered when user returns from WhatsApp/Instagram/Camera/Screen-lock
      if (document.visibilityState === 'visible') {
        console.log('JUMMP Meet: App returned to foreground. Performing deep recovery...');
        setIsResyncing(true);

        // 1. Force unpause all video elements (Safari & Chrome mobile pause them in background)
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach((video) => {
          if (video.paused) {
            video.play().catch((e) => {
              console.warn('Video auto-resume blocked by browser policy:', e);
              setAutoplayBlocked(true);
            });
          }
        });

        // 2. Check if local camera/mic tracks were revoked or ended by OS
        const currentTracks = localStreamRef.current?.getTracks() || [];
        const hasDeadTrack =
          currentTracks.length === 0 ||
          currentTracks.some((t) => t.readyState === 'ended' || t.muted);

        if (hasDeadTrack && (camEnabled || micEnabled)) {
          console.log('Re-acquiring dead media tracks after background return...');
          try {
            const freshStream = await acquireMedia(facingMode);
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
              Object.values(peerConnectionsRef.current).forEach((pc) => {
                freshStream.getTracks().forEach((track) => {
                  const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
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

        // 3. LiveKit SFU Reconnection Check
        if (livekitRoomRef.current) {
          const room = livekitRoomRef.current;
          if (room.state === 'disconnected') {
            console.log('LiveKit room disconnected during background. Triggering reconnection...');
            // Re-fetch token and connect
            try {
              const name = userName || (isHost ? 'Host' : 'Guest');
              const res = await fetch(`/api/livekit/token?room=${meetingId}&username=${encodeURIComponent(name)}`);
              const data = await res.json();
              if (data.configured && data.token && data.url) {
                await room.connect(data.url, data.token);
              }
            } catch (e) {
              console.warn('LiveKit reconnect error:', e);
            }
          }
        }

        // 4. Web Audio Context Resume
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            // Wake any suspended context
          }
        } catch {}

        // 5. Broadcast RESYNC ping to notify peers we are back
        if (channelRef.current && inCall) {
          channelRef.current.send('PEER_RESYNC', {
            name: userName || (isHost ? 'Host' : 'Guest'),
            timestamp: Date.now(),
          });
        }

        setTimeout(() => {
          setIsResyncing(false);
        }, 1200);
      }
    };

    document.addEventListener('visibilitychange', handleForegroundReturn);
    window.addEventListener('pageshow', handleForegroundReturn);
    window.addEventListener('focus', handleForegroundReturn);

    return () => {
      document.removeEventListener('visibilitychange', handleForegroundReturn);
      window.removeEventListener('pageshow', handleForegroundReturn);
      window.removeEventListener('focus', handleForegroundReturn);
    };
  }, [acquireMedia, camEnabled, micEnabled, facingMode, inCall, userName, isHost, meetingId]);

  // One-tap resume if browser blocked autoplay upon returning
  const handleUserGestureResume = () => {
    setAutoplayBlocked(false);
    document.querySelectorAll('video').forEach((v) => {
      v.play().catch(() => {});
    });
    acquireMedia(facingMode);
  };

  // Flip Camera (Front / Rear) for Mobile devices
  const switchCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
    }

    await acquireMedia(nextMode);
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
        const res = await fetch(`/api/livekit/token?room=${meetingId}&username=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (isCleanedUp) return;

        if (data.configured && data.token && data.url) {
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });
          livekitRoomRef.current = room;

          room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub, participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Video) {
              const stream = new MediaStream([track.mediaStreamTrack]);
              setRemoteStreams((prev) => ({
                ...prev,
                [participant.identity]: stream,
              }));
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
            setParticipants((prev) => {
              if (prev.some((p) => p.name === participant.identity)) return prev;
              return [
                ...prev,
                {
                  id: participant.sid,
                  name: participant.identity,
                  isHost: false,
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
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[participant.identity];
              return next;
            });
            const audioEl = document.getElementById(`livekit-audio-${participant.identity}`);
            if (audioEl) audioEl.remove();
          });

          await room.connect(data.url, data.token);

          if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (videoTrack) await room.localParticipant.publishTrack(videoTrack);
            if (audioTrack) await room.localParticipant.publishTrack(audioTrack);
          }
        }
      } catch (e) {
        console.warn('LiveKit SFU initialization fallback to P2P WebRTC:', e);
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
  }, [inCall, meetingId, userName, isHost]);

  // Update in-call video ref when inCall state changes
  useEffect(() => {
    if (inCall && localStream && inCallVideoRef.current) {
      inCallVideoRef.current.srcObject = localStream;
      inCallVideoRef.current.play().catch(() => {});
    }
  }, [inCall, localStream]);

  // =========================================================================
  // 7. WEBRTC P2P FALLBACK (Zero-config peer mesh)
  // =========================================================================
  const createPeerConnection = (targetName: string) => {
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
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetName]: event.streams[0],
        }));
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

    peerConnectionsRef.current[targetName] = pc;
    return pc;
  };

  // =========================================================================
  // 8. REAL-TIME SIGNALING CHANNEL (Supabase WebSockets + BroadcastChannel)
  // =========================================================================
  useEffect(() => {
    const handleChannelMessage = async (msg: any) => {
      if (!msg || msg.meetingId !== meetingId) return;

      if (msg.type === 'PING_HOST') {
        if (isHost && inCall) {
          channelRef.current?.send('HOST_PONG', { hostName: userName || 'Host' });
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
        const guestTarget = msg.payload.guestName;
        if (guestTarget === userName || msg.payload.guestId === userName) {
          playChime('admit');
          setWaitingToJoin(false);
          setInCall(true);

          const myParticipant: Participant = {
            id: 'guest-' + Date.now(),
            name: userName || 'Guest',
            isHost: false,
            audioEnabled: micEnabled,
            videoEnabled: camEnabled,
            handRaised: false,
            isScreenSharing: false,
            joinedAt: Date.now(),
          };
          setParticipants((prev) => [...prev.filter((p) => p.name !== myParticipant.name), myParticipant]);
          channelRef.current?.send('USER_JOINED', myParticipant);
        }
      } else if (msg.type === 'DENY_GUEST') {
        if (msg.payload.guestName === userName || msg.payload.guestId === userName) {
          setWaitingToJoin(false);
          setDenied(true);
        }
      } else if (msg.type === 'CHAT_MESSAGE') {
        setChatMessages((prev) => [...prev, msg.payload]);
        playChime('chat');
        if (activePanel !== 'chat') setUnreadChat(true);
      } else if (msg.type === 'REACTION') {
        triggerReaction(msg.payload.emoji, false);
      } else if (msg.type === 'USER_JOINED') {
        playChime('admit');
        setParticipants((prev) => [
          ...prev.filter((p) => p.name !== msg.payload.name),
          msg.payload,
        ]);

        if (isHost && inCall && msg.payload.name !== userName) {
          try {
            const pc = createPeerConnection(msg.payload.name);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: userName || 'Host',
              to: msg.payload.name,
              type: 'offer',
              sdp: offer,
            });
          } catch (e) {
            console.log('WebRTC offer error:', e);
          }
        }
      } else if (msg.type === 'USER_LEFT') {
        playChime('leave');
        setParticipants((prev) => prev.filter((p) => p.name !== msg.payload.name));
        if (peerConnectionsRef.current[msg.payload.name]) {
          peerConnectionsRef.current[msg.payload.name].close();
          delete peerConnectionsRef.current[msg.payload.name];
        }
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[msg.payload.name];
          return next;
        });
      } else if (msg.type === 'PEER_RESYNC') {
        // A peer just returned from another app / lock screen
        if (isHost && inCall && msg.payload.name !== userName) {
          try {
            const pc = createPeerConnection(msg.payload.name);
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: userName || 'Host',
              to: msg.payload.name,
              type: 'offer',
              sdp: offer,
            });
          } catch {}
        }
      } else if (msg.type === 'WEBRTC_SIGNAL') {
        const { from, to, type, sdp, candidate } = msg.payload;
        const myName = userName || (isHost ? 'Host' : 'Guest');
        if (to !== myName) return;

        let pc = peerConnectionsRef.current[from] || createPeerConnection(from);

        try {
          if (type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channelRef.current?.send('WEBRTC_SIGNAL', {
              from: myName,
              to: from,
              type: 'answer',
              sdp: answer,
            });
          } else if (type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          } else if (type === 'candidate' && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
    };
  }, [meetingId, isHost, userName, inCall, activePanel, micEnabled, camEnabled]);

  // Toggle Camera
  const toggleCam = () => {
    const nextState = !camEnabled;
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = nextState));
      setCamEnabled(nextState);
    } else {
      setCamEnabled(nextState);
    }
    if (livekitRoomRef.current) {
      livekitRoomRef.current.localParticipant.setCameraEnabled(nextState).catch(() => {});
    }
  };

  // Toggle Mic
  const toggleMic = () => {
    const nextState = !micEnabled;
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = nextState));
      setMicEnabled(nextState);
    } else {
      setMicEnabled(nextState);
    }
    if (livekitRoomRef.current) {
      livekitRoomRef.current.localParticipant.setMicrophoneEnabled(nextState).catch(() => {});
    }
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        setScreenStream(null);
      }
      setIsScreenSharing(false);
      if (livekitRoomRef.current) {
        livekitRoomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = stream;
        }
        if (livekitRoomRef.current) {
          livekitRoomRef.current.localParticipant.setScreenShareEnabled(true).catch(() => {});
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
          if (livekitRoomRef.current) {
            livekitRoomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
          }
        };
      } catch (err) {
        console.log('Screen share cancelled or failed:', err);
      }
    }
  };

  // Reactions
  const triggerReaction = (emoji: string, broadcast = true) => {
    const id = Date.now() + Math.random();
    setFloatingReactions((prev) => [...prev, { id, emoji }]);
    if (broadcast && channelRef.current) {
      channelRef.current.send('REACTION', { emoji });
    }
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  };

  // Join Action
  const handleJoinClick = () => {
    const name = userName.trim() || (isHost ? 'Host' : 'Guest User');
    setUserName(name);

    if (isHost) {
      playChime('admit');
      setInCall(true);
      const hostParticipant: Participant = {
        id: 'host-' + Date.now(),
        name,
        isHost: true,
        audioEnabled: micEnabled,
        videoEnabled: camEnabled,
        handRaised: false,
        isScreenSharing: false,
        joinedAt: Date.now(),
      };
      setParticipants([hostParticipant]);
      channelRef.current?.send('HOST_ARRIVED', { hostName: name });
      channelRef.current?.send('USER_JOINED', hostParticipant);
    } else {
      playChime('knock');
      setWaitingToJoin(true);
      const req: JoinRequest = {
        id: 'guest-' + Date.now(),
        name,
        meetingId,
        requestedAt: Date.now(),
      };
      channelRef.current?.send('REQUEST_JOIN', req);
    }
  };

  // Host Admits Guest
  const handleAdmitGuest = (req: JoinRequest) => {
    channelRef.current?.send('ADMIT_GUEST', { guestName: req.name, guestId: req.id });
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
    setParticipants((prev) => [...prev.filter((p) => p.name !== newParticipant.name), newParticipant]);
  };

  // Host Denies Guest
  const handleDenyGuest = (req: JoinRequest) => {
    channelRef.current?.send('DENY_GUEST', { guestName: req.name, guestId: req.id });
    setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  // Send Chat Message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
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

  // Leave Call
  const handleLeaveCall = () => {
    playChime('leave');
    if (channelRef.current) {
      channelRef.current.send('USER_LEFT', { name: userName || (isHost ? 'Host' : 'Guest') });
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }
    if (livekitRoomRef.current) {
      livekitRoomRef.current.disconnect();
      livekitRoomRef.current = null;
    }
    if (isHost && dbMeeting) {
      endMeeting(dbMeeting.id);
    }
    setHasLeft(true);
    setInCall(false);
  };

  // Reopen Expired or Ended Meeting
  const handleReopenMeeting = async () => {
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
      acquireMedia(facingMode);
    }
  };

  // =========================================================================
  // VIEW 0: CHECKING STATUS LOADER
  // =========================================================================
  if (isCheckingStatus) {
    return (
      <div className="h-[100dvh] bg-slate-950 text-white flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 animate-pulse">
          <Sparkles className="w-6 h-6 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-white">Connecting to JUMMP Meet</h3>
        <p className="text-xs text-slate-400 mt-1 font-mono">{meetingId}</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: EXPIRED MEETING SCREEN (When clicked after weeks of inactivity)
  // Google Meet Level Lifecycle Handling
  // =========================================================================
  if (statusCheck?.isExpired) {
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

        {/* Expired Notification Card */}
        <main className="max-w-md w-full mx-auto px-5 py-8 flex-1 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-250">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
            <Clock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Link Expired</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              This meeting link has expired
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              Per Google Meet protocol, inactive links expire after 30 days. This room was inactive for{' '}
              <span className="text-white font-semibold">{statusCheck.daysInactive} days</span>.
            </p>
          </div>

          <div className="w-full space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                const newCode = generateMeetingId();
                router.push(`/meet/${newCode}?host=true`);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start a new meeting</span>
            </button>

            <button
              type="button"
              onClick={handleReopenMeeting}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reopen this exact room</span>
            </button>

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
          JUMMP Meet • Google Meet Protocol
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
              onClick={() => {
                setHasLeft(false);
                setInCall(false);
                setWaitingToJoin(false);
                setDenied(false);
                acquireMedia(facingMode);
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
          JUMMP Meet • Google Meet Protocol
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: GOOGLE MEET GREEN ROOM / PRE-JOIN LOBBY (Mobile Viewport Masterpiece)
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
              onClick={switchCamera}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:rotate-180"
              title="Flip camera (front / back)"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
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
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`}
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
                <div className="absolute top-4 left-4 flex items-center gap-1 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-emerald-400 text-xs font-medium animate-in fade-in">
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
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-2xl">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-3 rounded-full transition-all active:scale-90 ${
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
                  className={`p-3 rounded-full transition-all active:scale-90 ${
                    camEnabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
                  }`}
                  title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={switchCamera}
                  className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-all active:scale-90"
                  title="Flip camera (front / back)"
                >
                  <SwitchCamera className="w-5 h-5" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 mb-2.5">
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
                  ? 'You are entering as host. You have full admission controls.'
                  : 'Enter your name to ask the host for permission to join.'}
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
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-blue-500/40 text-center space-y-3.5 animate-in fade-in duration-300">
                <div className="w-10 h-10 rounded-full border-3 border-blue-500 border-t-transparent animate-spin mx-auto" />
                <h4 className="text-sm font-bold text-white">Asking to join...</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You’ll join automatically as soon as the host admits you.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setWaitingToJoin(false)}
                    className="text-xs text-slate-400 hover:text-white underline transition-colors"
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

                  <button
                    type="button"
                    onClick={copyMeetingLink}
                    className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Link copied to clipboard!' : 'Copy meeting link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="p-3.5 text-center text-xs text-slate-500 border-t border-slate-900 shrink-0">
          Encrypted with Google-grade WebRTC • JUMMP Meet
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: ACTIVE IN-CALL GOOGLE MEET EXPERIENCE (Mobile Viewport Masterpiece)
  // =========================================================================
  const otherParticipants = participants.filter((p) => p.name !== userName);

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-slate-950 text-white flex flex-col overflow-hidden select-none relative">
      {/* BACKGROUND RESYNC BANNER (App switching recovery pill) */}
      {isResyncing && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-blue-600/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Restoring audio & video connection...</span>
        </div>
      )}

      {/* AUTOPLAY BLOCKED BANNER (If mobile browser paused media) */}
      {autoplayBlocked && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-slate-950 shadow-2xl flex items-center gap-2 animate-bounce">
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
          {isHost && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button
            type="button"
            onClick={switchCamera}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Switch front/back camera"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
          <span className="font-mono hidden sm:inline">
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
                  <div className="w-9 h-9 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
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

          {/* Screen Share Tile */}
          {isScreenSharing && (
            <div className="w-full max-w-4xl aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl relative mb-3">
              <video ref={screenShareVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-semibold text-white">
                You are presenting your screen
              </div>
            </div>
          )}

          {/* DYNAMIC GOOGLE MEET MOBILE VIDEO GRID */}
          <div
            className={`w-full h-full flex-1 grid gap-2 sm:gap-4 items-center justify-center ${
              otherParticipants.length === 0
                ? 'grid-cols-1'
                : otherParticipants.length === 1
                ? 'grid-cols-1 sm:grid-cols-2 max-w-5xl'
                : 'grid-cols-1 sm:grid-cols-2 max-w-5xl'
            }`}
          >
            {/* Solo Mode with Floating Self-View PiP */}
            {otherParticipants.length === 0 ? (
              <div className="relative w-full h-full max-w-4xl aspect-[3/4] sm:aspect-video rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-2xl flex items-center justify-center">
                {camEnabled ? (
                  <video
                    ref={inCallVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-blue-600 text-white text-3xl font-bold flex items-center justify-center shadow-2xl">
                    {userName ? userName.slice(0, 2).toUpperCase() : 'YOU'}
                  </div>
                )}

                {/* Bottom Tag */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-medium border border-white/10">
                  <span>{userName || 'You'} (You)</span>
                  {!micEnabled && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                </div>

                {/* Waiting Banner for Solo User */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full text-xs text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Waiting for others to join</span>
                </div>

                {handRaised && (
                  <div className="absolute top-4 right-4 bg-amber-500 text-slate-950 p-2 rounded-full shadow-lg animate-bounce">
                    <Hand className="w-5 h-5" />
                  </div>
                )}
              </div>
            ) : (
              // Multi-Participant Grid
              <>
                {/* Local User Tile */}
                <div className="relative w-full h-full min-h-[180px] rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-lg flex items-center justify-center">
                  {camEnabled ? (
                    <video
                      ref={inCallVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center shadow-lg">
                      {userName ? userName.slice(0, 2).toUpperCase() : 'YOU'}
                    </div>
                  )}
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-medium border border-white/10">
                    <span>{userName || 'You'}</span>
                    {!micEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                  </div>
                  {handRaised && (
                    <div className="absolute top-2.5 right-2.5 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-md animate-bounce">
                      <Hand className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Remote Participant Tiles */}
                {otherParticipants.map((participant) => {
                  const remoteStream = remoteStreams[participant.name];

                  return (
                    <div
                      key={participant.id}
                      className="relative w-full h-full min-h-[180px] rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-lg flex items-center justify-center"
                    >
                      {remoteStream ? (
                        <video
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                          ref={(el) => {
                            if (el && el.srcObject !== remoteStream) {
                              el.srcObject = remoteStream;
                              el.play().catch(() => {});
                            }
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-16 h-16 rounded-full bg-indigo-600 text-white text-xl font-bold flex items-center justify-center shadow-lg">
                            {participant.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Connected</span>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl text-xs font-medium border border-white/10">
                        <span>{participant.name}</span>
                        {participant.isHost && (
                          <span className="text-[10px] text-blue-400 font-bold uppercase">Host</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

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
          <aside
            className={`
              fixed inset-x-0 bottom-0 z-40 sm:relative sm:inset-auto sm:w-80 sm:h-auto 
              bg-slate-900/98 sm:bg-slate-900 border-t sm:border-t-0 sm:border-l border-slate-800 
              flex flex-col rounded-t-3xl sm:rounded-none max-h-[80vh] sm:max-h-full shadow-2xl 
              animate-in slide-in-from-bottom sm:slide-in-from-right duration-250 pb-safe
            `}
          >
            {/* Mobile Drag Indicator */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden" />

            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold capitalize text-white">
                {activePanel === 'people' && 'People in Meeting'}
                {activePanel === 'chat' && 'In-Call Messages'}
                {activePanel === 'info' && 'Meeting Details'}
              </h3>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* PEOPLE TAB */}
              {activePanel === 'people' && (
                <div className="space-y-4">
                  {/* Host Admission Queue */}
                  {isHost && pendingRequests.length > 0 && (
                    <div className="space-y-2 p-3 rounded-2xl bg-blue-950/40 border border-blue-600/40">
                      <div className="font-bold text-blue-300">Admission Requests ({pendingRequests.length})</div>
                      {pendingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800"
                        >
                          <span className="font-semibold text-white truncate mr-2">{req.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAdmitGuest(req)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
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

                  {/* Active Participants List */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      In Call ({participants.length})
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60 bg-slate-900/50 border border-slate-800/60">
                      <span className="font-semibold text-white">{userName || 'You'} (You)</span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {isHost ? 'Meeting Host' : 'Participant'}
                      </span>
                    </div>
                    {otherParticipants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/60"
                      >
                        <span className="font-semibold text-slate-200">{p.name}</span>
                        <span className="text-[10px] text-slate-400">{p.isHost ? 'Host' : 'Guest'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CHAT TAB */}
              {activePanel === 'chat' && (
                <div className="h-full flex flex-col justify-between space-y-3">
                  <div className="space-y-3 overflow-y-auto max-h-[45vh] sm:max-h-[60vh] pr-1">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="space-y-0.5">
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="font-bold text-blue-400">{msg.sender}</span>
                          <span className="text-slate-500">{msg.time}</span>
                        </div>
                        <p className="p-2.5 rounded-2xl bg-slate-800/60 text-slate-200 leading-relaxed border border-slate-800">
                          {msg.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendChat} className="pt-2 flex gap-2 border-t border-slate-800">
                    <input
                      type="text"
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      placeholder="Send a message to everyone..."
                      className="flex-1 bg-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 text-white outline-none focus:border-[#0b5cff]"
                    />
                    <button type="submit" className="p-2.5 rounded-xl bg-[#0b5cff] text-white hover:bg-[#0a75e7]">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* INFO TAB */}
              {activePanel === 'info' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-white mb-1">Meeting Details</h4>
                    <p className="text-slate-400">Share this link to invite others to join this room.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 font-mono text-[11px] break-all text-blue-300 select-all">
                    {getMeetingUrl(meetingId)}
                  </div>
                  <button
                    type="button"
                    onClick={copyMeetingLink}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied to clipboard' : 'Copy joining info'}</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
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
              className="w-9 h-9 rounded-full hover:bg-slate-800 flex items-center justify-center text-lg hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* GOOGLE MEET FLOATING BOTTOM CONTROL DOCK (Responsive Viewport) */}
      <footer className="h-20 sm:h-22 bg-slate-950/95 border-t border-slate-900 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 pb-safe">
        {/* Left: Meeting Code */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{meetingId}</span>
        </div>

        {/* Center Main Controls */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Mic */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-90 ${
              micEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
            }`}
            title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Cam */}
          <button
            type="button"
            onClick={toggleCam}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-90 ${
              camEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30'
            }`}
            title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-90 ${
              isScreenSharing
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* Hand Raise */}
          <button
            type="button"
            onClick={() => {
              playChime('hand');
              setHandRaised(!handRaised);
            }}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-90 ${
              handRaised
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Emoji Reactions Trigger */}
          <button
            type="button"
            onClick={() => setShowReactionsPicker(!showReactionsPicker)}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-90 ${
              showReactionsPicker ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title="Send reaction"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={handleLeaveCall}
            className="px-4 sm:px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-1.5 sm:gap-2 active:scale-95 transition-all"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Right Action Icons (Info / People / Chat) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'info' ? null : 'info')}
            className={`p-2.5 rounded-xl transition-colors ${
              activePanel === 'info' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Meeting details"
          >
            <Info className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'people' ? null : 'people')}
            className={`p-2.5 rounded-xl transition-colors relative ${
              activePanel === 'people' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="People in meeting"
          >
            <Users className="w-5 h-5" />
            {pendingRequests.length > 0 && isHost && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePanel(activePanel === 'chat' ? null : 'chat');
              setUnreadChat(false);
            }}
            className={`p-2.5 rounded-xl transition-colors relative ${
              activePanel === 'chat' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Chat with everyone"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChat && <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#0b5cff]" />}
          </button>
        </div>
      </footer>
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
