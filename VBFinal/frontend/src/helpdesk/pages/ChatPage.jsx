import React, { useEffect, useMemo, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ChatComposer from '../components/ChatComposer';
import ChatMessageBubble from '../components/ChatMessageBubble';
import HelpdeskShell from '../components/HelpdeskShell';
import { useHelpdeskSocket } from '../hooks/useHelpdeskSocket';
import helpdeskApi from '../services/helpdeskApi';


const LivekitTrackTile = ({ publication, participantName, isLocal }) => {
  const mediaRef = useRef(null);
  const track = publication?.track || null;
  const isVideo = publication?.kind === Track.Kind.Video;

  useEffect(() => {
    if (!track || !mediaRef.current) return;
    const mediaElement = mediaRef.current;
    track.attach(mediaElement);
    return () => {
      track.detach(mediaElement);
    };
  }, [track]);

  // Only render video tracks, skip audio tracks
  if (!isVideo) {
    return null;
  }

  return (
    <div className="grid h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
      <video ref={mediaRef} autoPlay playsInline muted={isLocal} className="aspect-video w-full rounded-lg bg-slate-100 object-cover" />
      <p className="mt-1 text-xs font-semibold text-slate-700">{participantName}{isLocal ? ' (You)' : ''}</p>
      <p className="text-[11px] text-slate-500">Video</p>
    </div>
  );
};

const DEFAULT_LIVEKIT_LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
const DEFAULT_LIVEKIT_FALLBACK_HOSTS = ['127.0.0.1', 'localhost', '0.0.0.0', '::1'];

const parseHostList = (rawValue, fallbackHosts) => {
  const source = (rawValue || '').trim();
  const hosts = source ? source.split(',') : fallbackHosts;
  return hosts.map((host) => host.trim().toLowerCase()).filter(Boolean);
};

const LOCAL_HOSTNAMES = new Set(
  parseHostList(import.meta.env.VITE_LIVEKIT_LOCAL_HOSTNAMES, DEFAULT_LIVEKIT_LOCAL_HOSTNAMES),
);
const LIVEKIT_FALLBACK_HOSTS = parseHostList(
  import.meta.env.VITE_LIVEKIT_FALLBACK_HOSTS,
  DEFAULT_LIVEKIT_FALLBACK_HOSTS,
);

const isLoopbackHost = (hostname) => {
  const normalizedHost = (hostname || '').toLowerCase();
  return LOCAL_HOSTNAMES.has(normalizedHost);
};

const resolveLivekitConnectUrl = (rawUrl) => {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const livekitUrl = new URL(rawUrl);
    if (typeof window === 'undefined') {
      return livekitUrl.toString().replace(/\/+$/, '');
    }

    const currentHost = window.location.hostname;
    if (isLoopbackHost(livekitUrl.hostname) && currentHost) {
      livekitUrl.hostname = currentHost;
    }

    if (window.location.protocol === 'https:' && livekitUrl.protocol === 'ws:') {
      livekitUrl.protocol = 'wss:';
    }

    return livekitUrl.toString().replace(/\/+$/, '');
  } catch {
    return rawUrl;
  }
};

const buildLocalHostFallbackUrls = (connectUrl) => {
  const fallbacks = [];
  try {
    const parsed = new URL(connectUrl);
    if (!isLoopbackHost(parsed.hostname)) {
      return fallbacks;
    }

    const alternateHosts = LIVEKIT_FALLBACK_HOSTS.filter((host) => host !== parsed.hostname);
    alternateHosts.forEach((host) => {
      const nextUrl = new URL(parsed.toString());
      nextUrl.hostname = host;
      fallbacks.push(nextUrl.toString().replace(/\/+$/, ''));
    });
  } catch {
    return [];
  }
  return fallbacks;
};

const formatMediaDeviceError = (err, label) => {
  const code = err?.name || err?.code || '';
  const message = (err?.message || '').toLowerCase();

  if (code === 'NotAllowedError' || message.includes('permission')) {
    return `${label} permission was denied. Allow ${label.toLowerCase()} access in browser site settings and retry.`;
  }
  if (code === 'NotFoundError' || message.includes('not found') || message.includes('no device')) {
    return `No ${label.toLowerCase()} device was found. Connect a device and retry.`;
  }
  if (code === 'NotReadableError' || message.includes('in use')) {
    return `${label} is busy in another app or browser tab. Close other apps using it and retry.`;
  }

  return err?.message || `Unable to start ${label.toLowerCase()}.`;
};

const requestCameraAccess = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  stream.getTracks().forEach((track) => track.stop());
};

const ChatPage = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const bottomRef = useRef(null);
  const roomRef = useRef(null);

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [conferenceError, setConferenceError] = useState('');
  const [conferenceStatus, setConferenceStatus] = useState('idle');
  const [conferenceConnected, setConferenceConnected] = useState(false);
  const [participantTracks, setParticipantTracks] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [removingParticipantId, setRemovingParticipantId] = useState(null);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [showAddParticipantsForm, setShowAddParticipantsForm] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const canConnectRealtime = !loading && !error && Boolean(session?.id);
  const supportsLivekit = ['audio_call', 'video_call', 'audio_conference', 'video_conference'].includes(session?.kind);
  const isVideoSession = ['video_call', 'video_conference'].includes(session?.kind);

  const appendIfMissing = (incoming) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === incoming.id)) {
        return prev;
      }
      return [...prev, incoming];
    });
  };

  const rebuildParticipantTracks = (room) => {
    const nextTracks = [];

    if (room.localParticipant) {
      room.localParticipant.trackPublications.forEach((publication) => {
        if (publication.track && publication.kind === Track.Kind.Video) {
          nextTracks.push({
            key: `local-${publication.trackSid}`,
            isLocal: true,
            participantName: room.localParticipant.name || 'You',
            publication,
          });
        }
      });
    }

    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track && publication.kind === Track.Kind.Video) {
          nextTracks.push({
            key: `${participant.identity}-${publication.trackSid}`,
            isLocal: false,
            participantName: participant.name || participant.identity,
            publication,
          });
        }
      });
    });

    setParticipantTracks(nextTracks);
  };

  const { isConnected, connectionError, send } = useHelpdeskSocket({
    sessionId,
    enabled: canConnectRealtime,
    onMessage: (payload) => {
      if (payload?.type !== 'chat.message') {
        return;
      }
      if (payload?.message) {
        appendIfMissing(payload.message);
      }
    },
  });

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    let cancelled = false;

    const refreshMessages = async () => {
      try {
        const latestMessages = await helpdeskApi.getMessages(sessionId);
        if (cancelled) {
          return;
        }

        setMessages((prev) => {
          const next = [...prev];
          const seen = new Set(prev.map((message) => message.id));

          latestMessages.forEach((message) => {
            if (!seen.has(message.id)) {
              next.push(message);
            }
          });

          return next.sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
        });
      } catch {
        // Keep the existing websocket stream as the primary source of updates.
      }
    };

    refreshMessages();
    const intervalId = setInterval(refreshMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [sessionId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [sessionPayload, messagePayload, candidatesPayload] = await Promise.all([
          helpdeskApi.getSession(sessionId),
          helpdeskApi.getMessages(sessionId),
          helpdeskApi.getSessionCandidates().catch(() => []),
        ]);
        setSession(sessionPayload);
        setMessages(messagePayload);
        setCandidates(candidatesPayload || []);
      } catch (err) {
        setError(err.message || 'Failed to load chat session.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages]);

  const visibleMessages = useMemo(() => {
    return sortedMessages.filter((message) => message.message_type !== 'signal');
  }, [sortedMessages]);

  const handleSend = async (text) => {
    setSendError('');

    const payload = {
      type: 'chat.message',
      message_type: 'text',
      content: text,
      payload: {},
    };

    const wsSent = send(payload);
    if (wsSent) {
      return;
    }

    try {
      const created = await helpdeskApi.postMessage(sessionId, {
        message_type: 'text',
        content: text,
        payload: {},
      });
      appendIfMissing(created);
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
    }
  };



  const handleRemoveParticipant = async (participantId) => {
    if (!session?.id || !participantId) return;
    const confirmed = window.confirm('Remove this participant from the session?');
    if (!confirmed) return;

    setRemovingParticipantId(participantId);
    try {
      const updated = await helpdeskApi.removeParticipants(session.id, [participantId]);
      setSession(updated);
    } catch (err) {
      setSendError(err.message || 'Failed to remove participant.');
    } finally {
      setRemovingParticipantId(null);
    }
  };

  const handleAddParticipants = async () => {
    if (!session?.id || selectedCandidates.length === 0) return;

    setAddingParticipants(true);
    try {
      const updated = await helpdeskApi.addParticipants(session.id, selectedCandidates);
      setSession(updated);
      setSelectedCandidates([]);
      setShowAddParticipantsForm(false);
    } catch (err) {
      setSendError(err.message || 'Failed to add participants.');
    } finally {
      setAddingParticipants(false);
    }
  };

  const isSessionCreator = session && String(session.created_by_id) === String(user?.id);
  const sessionParticipants = Array.isArray(session?.participants) ? session.participants : [];
  const participantIds = new Set(sessionParticipants.map((p) => p.user_id));
  const availableCandidates = (candidates || []).filter((c) => !participantIds.has(c.id));

  const handleJoinConference = async () => {
    if (!session?.id) return;
    if (conferenceStatus === 'connecting') return;
    if (conferenceConnected) return;
    if (!supportsLivekit) {
      setConferenceError('This session type does not use multi-user conference mode.');
      return;
    }

    try {
      setConferenceStatus('connecting');
      setConferenceError('');

      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }

      const tokenPayload = await helpdeskApi.getLivekitToken(session.id);
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.TrackUnsubscribed, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.ParticipantConnected, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.ParticipantDisconnected, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.LocalTrackPublished, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.LocalTrackUnpublished, () => rebuildParticipantTracks(room));
      room.on(RoomEvent.Disconnected, () => {
        setConferenceConnected(false);
        setConferenceStatus('disconnected');
        setParticipantTracks([]);
        setIsCameraEnabled(false);
        setIsMicEnabled(false);
        setCameraPermissionBlocked(false);
      });

      const primaryConnectUrl = resolveLivekitConnectUrl(tokenPayload.url);
      const candidateUrls = [primaryConnectUrl, ...buildLocalHostFallbackUrls(primaryConnectUrl)];

      let connected = false;
      let lastConnectError = null;
      for (const url of candidateUrls) {
        try {
          await room.connect(url, tokenPayload.token);
          connected = true;
          break;
        } catch (connectErr) {
          lastConnectError = connectErr;
        }
      }

      if (!connected) {
        throw lastConnectError || new Error('Failed to connect to LiveKit room.');
      }
      setConferenceConnected(true);
      setConferenceStatus('connected');
      rebuildParticipantTracks(room);

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicEnabled(true);
      } catch (micErr) {
        setConferenceError(formatMediaDeviceError(micErr, 'Microphone'));
      }

      if (isVideoSession) {
        try {
          await requestCameraAccess();
          await room.localParticipant.setCameraEnabled(true);
          setIsCameraEnabled(true);
          setCameraPermissionBlocked(false);
          rebuildParticipantTracks(room);
        } catch (camErr) {
          setIsCameraEnabled(false);

          setConferenceError(formatMediaDeviceError(camErr, 'Camera'));
        }
      } else {
        setIsCameraEnabled(false);
        setCameraPermissionBlocked(false);
      }
    } catch (err) {
      setConferenceError(err.message || 'Failed to join conference.');
      setConferenceStatus('failed');
    }
  };

  const handleLeaveConference = async () => {
    if (roomRef.current) {
      roomRef.current.disconnect(true);
      roomRef.current = null;
    }
    setParticipantTracks([]);
    setConferenceConnected(false);
    setConferenceStatus('disconnected');
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
  };

  const handleToggleCamera = async () => {
    const room = roomRef.current;
    if (!room || !conferenceConnected) return;

    try {
      setConferenceError('');
      const newState = !isCameraEnabled;
      if (newState && !isVideoSession) return; // Don't enable camera for audio-only sessions

      if (newState) {
        await requestCameraAccess();
      }
      await room.localParticipant.setCameraEnabled(newState);
      setIsCameraEnabled(newState);
      setCameraPermissionBlocked(false);
      rebuildParticipantTracks(room);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || `${err?.message || ''}`.toLowerCase().includes('permission')) {
        setCameraPermissionBlocked(true);
      }
      setConferenceError(formatMediaDeviceError(err, 'Camera'));
    }
  };

  const handleToggleMic = async () => {
    const room = roomRef.current;
    if (!room || !conferenceConnected) return;

    try {
      setConferenceError('');
      const newState = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(newState);
      setIsMicEnabled(newState);
    } catch (err) {
      setConferenceError(formatMediaDeviceError(err, 'Microphone'));
    }
  };

  useEffect(() => {
    const updateMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => {
      window.removeEventListener('resize', updateMobile);
      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }
    };
  }, []);

  return (
    <HelpdeskShell showChrome={false} contentClassName="w-full max-w-none p-0">
      <div className={`relative min-h-screen overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.15),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.12),_transparent_30%)]" />
        <div className="relative flex min-h-screen flex-col px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/70 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Helpdesk conference</p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{session?.title || 'Live Helpdesk Session'}</h1>
                
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${conferenceConnected ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                  {conferenceConnected ? 'Conference Connected' : 'Conference Idle'}
                </span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${isConnected ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {isConnected ? 'Chat Connected' : 'Chat Syncing'}
                </span>
                <Link
                  to="/helpdesk"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Back to sessions
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  onClick={handleJoinConference}
                  disabled={!supportsLivekit || conferenceConnected || conferenceStatus === 'connecting'}
                  className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Join Conference
                </button>
                <button
                  onClick={handleLeaveConference}
                  disabled={!conferenceConnected}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Leave Conference
                </button>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-800/60 dark:bg-cyan-900/30 dark:text-cyan-200"
                >
                  Open Chat
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={handleToggleCamera}
                  disabled={!isVideoSession || !conferenceConnected}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isCameraEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isCameraEnabled ? 'Camera On' : 'Camera Off'}
                </button>
                <button
                  onClick={handleToggleMic}
                  disabled={!conferenceConnected}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isMicEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isMicEnabled ? 'Mic On' : 'Mic Off'}
                </button>
              </div>
            </div>

            {(connectionError || conferenceError) && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-200">
                {connectionError && <p>{connectionError}</p>}
                {conferenceError && <p>{conferenceError}</p>}
              </div>
            )}
          </div>

          <section className="relative flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-2xl shadow-slate-900/40 backdrop-blur-xl">
            <div className="h-full overflow-hidden p-4 sm:p-5">
              <div className="grid min-h-[32rem] gap-4 md:grid-cols-2 xl:grid-cols-3">
                {supportsLivekit && conferenceConnected && participantTracks.length > 0 ? (
                  participantTracks.map((item) => (
                    <LivekitTrackTile
                      key={item.key}
                      publication={item.publication}
                      participantName={item.participantName}
                      isLocal={item.isLocal}
                    />
                  ))
                ) : (
                  <div className="col-span-full flex items-center justify-center rounded-[1.75rem] border border-dashed border-slate-600/80 bg-slate-950/70 p-10 text-center text-sm text-slate-300 shadow-inner shadow-black/20">
                    <div>
                      <p className="text-lg font-semibold">{supportsLivekit ? 'Video conference starting soon' : 'Conference unavailable for this session type'}</p>
                      <p className="mt-3 text-sm text-slate-400">{supportsLivekit ? 'Click Join Conference to connect and load participant media.' : 'This session type does not support LiveKit conference mode.'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] border-t border-white/10 bg-slate-950/95 px-4 py-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleToggleMic}
                  disabled={!conferenceConnected}
                  className={`flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${isMicEnabled ? 'border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-600' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isMicEnabled ? '🎙️ Mic On' : '🎤 Mic Off'}
                </button>
                <button
                  onClick={handleToggleCamera}
                  disabled={!conferenceConnected || !isVideoSession}
                  className={`flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition ${isCameraEnabled ? 'border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-600' : 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isCameraEnabled ? '📷 Camera On' : '📸 Camera Off'}
                </button>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-cyan-400 bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  💬 Chat
                </button>
                <button
                  onClick={handleLeaveConference}
                  disabled={!conferenceConnected}
                  className="flex items-center gap-2 rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⏹️ End Call
                </button>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 sm:hidden"
                >
                  Participants
                </button>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className={`rounded-[1.75rem] border ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white/90'} p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl`}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Session Details</h2>
              <div className="mt-4 grid gap-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Type</p>
                  <p className="mt-1 font-semibold">{session?.kind || 'N/A'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Participants</p>
                  <p className="mt-1 font-semibold">{sessionParticipants.length}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Created</p>
                  <p className="mt-1 font-semibold">{session?.created_at ? new Date(session.created_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-[1.75rem] border ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white/90'} p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Participants</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Manage session people and controls.</p>
                </div>
                {isSessionCreator && availableCandidates.length > 0 && (
                  <button
                    onClick={() => setShowAddParticipantsForm(!showAddParticipantsForm)}
                    className="rounded-full border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800/60 dark:bg-cyan-900/20 dark:text-cyan-200"
                  >
                    {showAddParticipantsForm ? 'Cancel' : 'Add'}
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3 max-h-80 overflow-y-auto pr-1">
                {sessionParticipants.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No participants available.</p>}
                {sessionParticipants.map((participant) => (
                  <div
                    key={`${participant.user_id}-${participant.joined_at}`}
                    className={`rounded-3xl border px-4 py-3 transition ${isDark ? 'border-slate-700 bg-slate-800 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{participant.full_name || 'Unknown user'}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{participant.role_name || 'member'} {participant.role === 'host' && '(Host)'}</p>
                      </div>
                      {isSessionCreator && participant.role !== 'host' && (
                        <button
                          onClick={() => handleRemoveParticipant(participant.user_id)}
                          disabled={removingParticipantId === participant.user_id}
                          className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/40"
                        >
                          {removingParticipantId === participant.user_id ? '...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isSessionCreator && showAddParticipantsForm && availableCandidates.length > 0 && (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {availableCandidates.map((candidate) => (
                      <label
                        key={candidate.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition ${selectedCandidates.includes(candidate.id)
                          ? 'bg-cyan-100 dark:bg-cyan-900/80'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCandidates.includes(candidate.id)}
                          onChange={() => {
                            if (selectedCandidates.includes(candidate.id)) {
                              setSelectedCandidates(selectedCandidates.filter((id) => id !== candidate.id));
                            } else {
                              setSelectedCandidates([...selectedCandidates, candidate.id]);
                            }
                          }}
                          className="h-4 w-4 rounded accent-cyan-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{candidate.full_name || candidate.email}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleAddParticipants}
                    disabled={selectedCandidates.length === 0 || addingParticipants}
                    className="mt-3 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingParticipants ? 'Adding...' : 'Add Selected'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm sm:items-center"
              >
                <motion.div
                  initial={{ y: 50, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 50, opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  className={`w-full ${isMobile ? 'max-w-full rounded-t-3xl' : 'max-w-3xl rounded-[2rem]'} bg-white shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-950`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Helpdesk Chat</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Chat overlay · messages are always synced.</p>
                    </div>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[70vh] overflow-hidden rounded-b-[2rem] bg-slate-50 dark:bg-slate-900">
                    <div className="h-full overflow-y-auto p-5">
                      {!loading && !error && visibleMessages.length === 0 && (
                        <p className="text-center text-sm text-slate-500 dark:text-slate-400">No messages yet. Start the conversation.</p>
                      )}
                      {!loading && !error && visibleMessages.map((message) => (
                        <ChatMessageBubble
                          key={message.id}
                          message={message}
                          isOwn={String(message.sender_id) === String(user?.id)}
                        />
                      ))}
                      <div ref={bottomRef} />
                    </div>
                    {sendError && <p className="px-5 py-3 text-sm text-rose-700">{sendError}</p>}
                    <ChatComposer onSend={handleSend} disabled={!!error || session?.status === 'ended'} />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center justify-center rounded-full bg-cyan-600 px-4 py-4 text-white shadow-2xl shadow-cyan-500/30 transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
          >
            💬
          </button>
        </div>
      </div>
    </HelpdeskShell>
  );
};

export default ChatPage;
