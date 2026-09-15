'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
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
} from 'lucide-react';
import {
  MeetChannel,
  Participant,
  ChatMessage,
  JoinRequest,
  getMeetingUrl,
  playChime,
} from '@/lib/meetStore';
import {
  createOrGetMeeting,
  saveChatMessage,
  getMeetingMessages,
  DBMeeting,
} from '@/lib/supabaseClient';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track } from 'livekit-client';

function MeetContent({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHostQuery = searchParams.get('host') === 'true';

  // Lobby / In-Call phase
  const [inCall, setInCall] = useState(false);
  const [waitingToJoin, setWaitingToJoin] = useState(false);
  const [denied, setDenied] = useState(false);
  const [hostInMeeting, setHostInMeeting] = useState(false);

  // User media state
  const [userName, setUserName] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // Streams
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const inCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Remote WebRTC streams: { [participantName]: MediaStream }
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  // Meeting coordination
  const [isHost, setIsHost] = useState(isHostQuery);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'JUMMP Bot', text: 'Welcome to JUMMP Meet. Call is secure and ready.', time: 'Just now' },
  ]);
  const [newChatText, setNewChatText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);

  // UI Panels
  const [activePanel, setActivePanel] = useState<'people' | 'chat' | 'info' | null>(null);
  const [copied, setCopied] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);

  const [dbMeeting, setDbMeeting] = useState<DBMeeting | null>(null);
  const livekitRoomRef = useRef<Room | null>(null);

  const channelRef = useRef<MeetChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize Supabase meeting record and load past messages
  useEffect(() => {
    async function initSupabase() {
      const meeting = await createOrGetMeeting(meetingId, isHostQuery ? 'Host' : 'Guest');
      if (meeting) {
        setDbMeeting(meeting);
        const messages = await getMeetingMessages(meeting.id);
        if (messages && messages.length > 0) {
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
    initSupabase();
  }, [meetingId, isHostQuery]);

  // Connect to LiveKit Cloud SFU if configured when call starts
  useEffect(() => {
    if (!inCall) return;

    async function connectLiveKit() {
      try {
        const name = userName || (isHost ? 'Host' : 'Guest');
        const res = await fetch(`/api/livekit/token?room=${meetingId}&username=${encodeURIComponent(name)}`);
        const data = await res.json();
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
            }
          });

          room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            setRemoteStreams((prev) => {
              const next = { ...prev };
              delete next[participant.identity];
              return next;
            });
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
        console.warn('LiveKit SFU connection error, using P2P fallback:', e);
      }
    }

    connectLiveKit();

    return () => {
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
      }
    };
  }, [inCall, meetingId, userName, isHost]);

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Initialize camera & mic in Lobby
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.log('Camera/Mic permission not granted or unavailable:', err);
        setCamEnabled(false);
        setMicEnabled(false);
      }
    }

    startMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Update in-call video ref when inCall state changes
  useEffect(() => {
    if (inCall && localStream && inCallVideoRef.current) {
      inCallVideoRef.current.srcObject = localStream;
    }
  }, [inCall, localStream]);

  // WebRTC Peer Connection Helper
  const createPeerConnection = (targetName: string) => {
    if (peerConnectionsRef.current[targetName]) {
      return peerConnectionsRef.current[targetName];
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetName]: event.streams[0],
        }));
      }
    };

    // Handle ICE candidates
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

  // Handle cross-tab communication (host admit, join requests, chat, participants, WebRTC)
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
        setParticipants((prev) => [
          ...prev.filter((p) => p.name !== msg.payload.name),
          msg.payload,
        ]);

        // Host establishes WebRTC connection with new guest
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

    // Ping host to see if host is already in meeting
    channel.send('PING_HOST', { timestamp: Date.now() });

    // Listen to localStorage for multi-window sync
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
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((t) => (t.enabled = !camEnabled));
      setCamEnabled(!camEnabled);
    } else {
      setCamEnabled(!camEnabled);
    }
  };

  // Toggle Mic
  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !micEnabled));
      setMicEnabled(!micEnabled);
    } else {
      setMicEnabled(!micEnabled);
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
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = stream;
        }
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
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
    }, 2500);
  };

  // Join Action
  const handleJoinClick = () => {
    const name = userName.trim() || (isHost ? 'Host' : 'Guest User');
    setUserName(name);

    if (isHost) {
      // Host enters immediately
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
      // Guest sends admission request to host
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
      sender: userName || 'You',
      text: newChatText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, msg]);
    channelRef.current?.send('CHAT_MESSAGE', msg);
    if (dbMeeting) {
      saveChatMessage(dbMeeting.id, userName || 'You', newChatText.trim());
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
    if (channelRef.current) {
      channelRef.current.send('USER_LEFT', { name: userName || (isHost ? 'Host' : 'Guest') });
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }
    router.push('/');
  };

  // =========================================================================
  // RENDER 1: GREEN ROOM / PRE-JOIN LOBBY
  // =========================================================================
  if (!inCall) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-blue-500/30">
        {/* Top Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/80">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-8 w-28">
              <Image
                src="/assets/jummp-logo.png"
                alt="JUMMP"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 border-l border-slate-800 pl-3">
              Meet
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              {meetingId}
            </div>
          </div>
        </header>

        {/* Main Lobby Box */}
        <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1 flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Left: Camera Preview Tile */}
          <div className="w-full md:w-3/5 space-y-4">
            <div className="relative aspect-video rounded-2xl md:rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group">
              {camEnabled ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300">
                    {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
                  </div>
                  <span className="text-xs font-medium">Camera is off</span>
                </div>
              )}

              {/* Floating Bottom Media Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`p-3 rounded-full transition-colors ${
                    micEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={micEnabled ? 'Turn off microphone' : 'Turn on microphone'}
                >
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCam}
                  className={`p-3 rounded-full transition-colors ${
                    camEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Audio Indicator */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-2">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                {micEnabled ? 'Microphone active' : 'Microphone muted'}
              </span>
              <span className="text-slate-500 font-mono">HD Audio • Stereo</span>
            </div>
          </div>

          {/* Right: Join Form */}
          <div className="w-full md:w-2/5 space-y-6 text-center md:text-left">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {isHost ? 'Ready to lead the call?' : 'Ready to join?'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {isHost
                  ? 'You are entering as host. You have full admission and controls.'
                  : 'Enter your display name to ask the host for permission to join.'}
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
              <div className="p-6 rounded-2xl bg-slate-900 border border-blue-500/40 text-center space-y-3.5 animate-in fade-in duration-300">
                <div className="w-10 h-10 rounded-full border-3 border-blue-500 border-t-transparent animate-spin mx-auto" />
                <h4 className="text-sm font-bold text-white">Asking to join...</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  You’ll join the call automatically as soon as the host admits you.
                </p>
                <div className="pt-2">
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
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder={isHost ? 'Host' : 'Your name'}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:border-[#0b5cff] focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleJoinClick}
                    className="w-full py-3.5 px-4 rounded-xl bg-[#0b5cff] hover:bg-[#0a75e7] active:scale-98 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <span>{isHost ? 'Join now' : 'Ask to join'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={copyMeetingLink}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Meeting link copied!' : 'Copy meeting link'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="p-4 text-center text-xs text-slate-500 border-t border-slate-900">
          Encrypted with Google-style WebRTC Protocol • JUMMP Meet
        </footer>
      </div>
    );
  }

  // =========================================================================
  // RENDER 2: ACTIVE IN-CALL GOOGLE MEET EXPERIENCE
  // =========================================================================
  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Meeting Header Bar */}
      <header className="h-12 bg-slate-900/90 border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="relative h-6 w-20">
            <Image
              src="/assets/jummp-logo.png"
              alt="JUMMP"
              fill
              priority
              className="object-contain object-left"
            />
          </Link>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-xs font-bold text-slate-300 truncate max-w-xs">{meetingId}</span>
          {isHost && (
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Host
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <button
            type="button"
            onClick={copyMeetingLink}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share link'}</span>
          </button>
          <span className="font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </header>

      {/* Main Video Stage & Drawers */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Canvas / Grid Area */}
        <div className="flex-1 bg-slate-950 p-3 sm:p-4 flex flex-col justify-center items-center relative overflow-hidden">
          {/* FLOATING HOST KNOCK BANNER: Someone wants to join this call */}
          {isHost && pendingRequests.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md bg-slate-900/95 backdrop-blur-md border border-blue-500/50 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <div className="text-[11px] text-slate-400 font-medium">Someone wants to join this call</div>
                    <div className="text-sm font-bold text-white truncate">{pendingRequests[0].name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDenyGuest(pendingRequests[0])}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdmitGuest(pendingRequests[0])}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/30 transition-colors"
                  >
                    Admit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Screen Share Tile (if active) */}
          {isScreenSharing && (
            <div className="w-full max-w-4xl aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl relative mb-4">
              <video ref={screenShareVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-semibold text-white">
                You are sharing your screen
              </div>
            </div>
          )}

          {/* Participants Video Grid */}
          <div
            className={`w-full max-w-5xl grid gap-3 sm:gap-4 flex-1 items-center justify-center ${
              participants.length <= 1 ? 'grid-cols-1 max-w-3xl aspect-video' : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {/* User Tile */}
            <div className="relative w-full h-full min-h-[220px] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg flex items-center justify-center group">
              {camEnabled ? (
                <video
                  ref={inCallVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center shadow-md">
                  {userName ? userName.slice(0, 2).toUpperCase() : 'ME'}
                </div>
              )}

              {/* Bottom Tag */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-medium border border-white/10">
                <span>{userName || 'You'} (You)</span>
                {!micEnabled && <MicOff className="w-3.5 h-3.5 text-red-400" />}
              </div>

              {handRaised && (
                <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 p-2 rounded-full shadow-lg animate-bounce">
                  <Hand className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Remote Participants */}
            {participants
              .filter((p) => p.name !== userName)
              .map((participant) => {
                const remoteStream = remoteStreams[participant.name];

                return (
                  <div
                    key={participant.id}
                    className="relative w-full h-full min-h-[220px] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg flex items-center justify-center"
                  >
                    {remoteStream ? (
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        ref={(el) => {
                          if (el && el.srcObject !== remoteStream) {
                            el.srcObject = remoteStream;
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-20 h-20 rounded-full bg-indigo-600 text-white text-2xl font-bold flex items-center justify-center shadow-md">
                          {participant.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Connected</span>
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-medium border border-white/10">
                      <span>{participant.name}</span>
                      {participant.isHost && (
                        <span className="text-[10px] text-blue-400 font-bold uppercase">Host</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Floating Reactions Display */}
          <div className="absolute bottom-8 right-12 pointer-events-none flex flex-col items-center">
            {floatingReactions.map((r) => (
              <span
                key={r.id}
                className="text-4xl animate-float opacity-90 transition-all"
                style={{ animationDuration: '2s' }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Side Panel (People / Chat / Info) */}
        {activePanel && (
          <aside className="w-full sm:w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-30">
            {/* Panel Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold capitalize text-white">
                {activePanel === 'people' && 'People in Meeting'}
                {activePanel === 'chat' && 'In-Call Messages'}
                {activePanel === 'info' && 'Meeting Details'}
              </h3>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
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
                    <div className="space-y-2 p-3 rounded-xl bg-blue-950/40 border border-blue-600/40">
                      <div className="font-bold text-blue-300">Admission Requests ({pendingRequests.length})</div>
                      {pendingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800"
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
                    <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60">
                      <span className="font-semibold text-white">{userName || 'You'} (You)</span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        {isHost ? 'Meeting Host' : 'Participant'}
                      </span>
                    </div>
                    {participants
                      .filter((p) => p.name !== userName)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60">
                          <span className="font-semibold text-slate-200">{p.name}</span>
                          <span className="text-[10px] text-slate-400">{p.isHost ? 'Host' : 'Guest'}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* CHAT TAB */}
              {activePanel === 'chat' && (
                <div className="h-full flex flex-col justify-between">
                  <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="space-y-0.5">
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="font-bold text-blue-400">{msg.sender}</span>
                          <span className="text-slate-500">{msg.time}</span>
                        </div>
                        <p className="p-2 rounded-xl bg-slate-800/60 text-slate-200 leading-relaxed border border-slate-800">
                          {msg.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendChat} className="pt-3 flex gap-2 border-t border-slate-800">
                    <input
                      type="text"
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      placeholder="Send a message to everyone..."
                      className="flex-1 bg-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-700 text-white outline-none focus:border-[#0b5cff]"
                    />
                    <button type="submit" className="p-2 rounded-xl bg-[#0b5cff] text-white hover:bg-[#0a75e7]">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* INFO TAB */}
              {activePanel === 'info' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-white mb-1">Joining Info</h4>
                    <p className="text-slate-400">Share this link with attendees to join this meeting directly.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 font-mono text-[11px] break-all text-blue-300 select-all">
                    {getMeetingUrl(meetingId)}
                  </div>
                  <button
                    type="button"
                    onClick={copyMeetingLink}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied to clipboard' : 'Copy joining info'}</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Google Meet Style Bottom Floating Control Bar */}
      <footer className="h-20 bg-slate-950 border-t border-slate-900 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
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
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 ${
              micEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30'
            }`}
            title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Cam */}
          <button
            type="button"
            onClick={toggleCam}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 ${
              camEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30'
            }`}
            title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 ${
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
            onClick={() => setHandRaised(!handRaised)}
            className={`p-3 sm:p-3.5 rounded-full transition-all active:scale-95 ${
              handRaised
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Emoji Reactions Picker */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-full border border-slate-800">
            {['👏', '❤️', '🔥', '🎉', '👍'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => triggerReaction(emoji)}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-sm hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* End Call Button */}
          <button
            type="button"
            onClick={handleLeaveCall}
            className="px-5 sm:px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-2 active:scale-95 transition-all"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Right Action Icons (Info / People / Chat) */}
        <div className="flex items-center gap-2">
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
            {unreadChat && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#0b5cff]" />
            )}
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
        <div className="h-screen bg-slate-950 text-white flex items-center justify-center">
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
