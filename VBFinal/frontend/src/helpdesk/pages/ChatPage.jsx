import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  return (
    <div className="grid h-full w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
      {isVideo ? (
        <video ref={mediaRef} autoPlay playsInline muted={isLocal} className="aspect-video w-full rounded-lg bg-slate-100 object-cover" />
      ) : (
        <div className="flex min-h-48 flex-1 items-center justify-center rounded-lg bg-slate-100 px-3 py-6 text-center text-xs text-slate-500">
          <audio ref={mediaRef} autoPlay muted={isLocal} />
          Audio track
        </div>
      )}
      <p className="mt-1 text-xs font-semibold text-slate-700">{participantName}{isLocal ? ' (You)' : ''}</p>
      <p className="text-[11px] text-slate-500">{publication?.kind === Track.Kind.Video ? 'Video' : 'Audio'}</p>
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
  const [updatingSession, setUpdatingSession] = useState(false);
  const [conferenceStatus, setConferenceStatus] = useState('idle');
  const [conferenceConnected, setConferenceConnected] = useState(false);
  const [participantTracks, setParticipantTracks] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [cameraPermissionBlocked, setCameraPermissionBlocked] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [removingParticipantId, setRemovingParticipantId] = useState(null);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [showAddParticipantsForm, setShowAddParticipantsForm] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
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
        if (publication.track && (publication.kind === Track.Kind.Video || publication.kind === Track.Kind.Audio)) {
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
        if (publication.track && (publication.kind === Track.Kind.Video || publication.kind === Track.Kind.Audio)) {
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

  const handleStartSession = async () => {
    if (!session) return;
    setUpdatingSession(true);
    try {
      const updated = await helpdeskApi.startSession(session.id);
      setSession(updated);
    } catch (err) {
      setSendError(err.message || 'Failed to start session.');
    } finally {
      setUpdatingSession(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setUpdatingSession(true);
    try {
      const updated = await helpdeskApi.endSession(session.id);
      setSession(updated);
    } catch (err) {
      setSendError(err.message || 'Failed to end session.');
    } finally {
      setUpdatingSession(false);
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
          setCameraPermissionBlocked(camErr?.name === 'NotAllowedError' || `${camErr?.message || ''}`.toLowerCase().includes('permission'));
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
    setCameraPermissionBlocked(false);
  };

  const handleAllowCameraAccess = async () => {
    const room = roomRef.current;
    if (!room || !conferenceConnected || !isVideoSession) return;

    try {
      setConferenceError('');
      await requestCameraAccess();
      await room.localParticipant.setCameraEnabled(true);
      setIsCameraEnabled(true);
      setCameraPermissionBlocked(false);
      rebuildParticipantTracks(room);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || `${err?.message || ''}`.toLowerCase().includes('permission')) {
        setCameraPermissionBlocked(true);
      }
      setConferenceError(formatMediaDeviceError(err, 'Camera'));
    }
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect(true);
        roomRef.current = null;
      }
    };
  }, []);

  return (
    <HelpdeskShell showChrome={false} contentClassName="w-full max-w-none p-0">
      <div className="h-screen overflow-hidden bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(340px,3fr)]">
        <section className="flex min-h-[36rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Video Conference</p>
                <h1 className="text-lg font-semibold text-slate-900">{session?.title || 'Session Conversation'}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 font-semibold ${conferenceConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {conferenceConnected ? 'Conference Connected' : 'Conference Idle'}
                </span>
                <span className={`rounded-full px-3 py-1 font-semibold ${isConnected ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                  {isConnected ? 'Chat Connected' : 'Chat Syncing'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleJoinConference}
                disabled={!supportsLivekit || conferenceConnected || conferenceStatus === 'connecting'}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Join Conference
              </button>
              <button
                onClick={handleLeaveConference}
                disabled={!conferenceConnected}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Leave Conference
              </button>
              <button
                onClick={handleStartSession}
                disabled={updatingSession || session?.status === 'active'}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Session
              </button>
              <button
                onClick={handleEndSession}
                disabled={updatingSession || session?.status === 'ended'}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                End Session
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                Status: {session?.status || 'unknown'}
              </span>
            </div>

            {(connectionError || conferenceError) && (
              <div className="mt-3 space-y-1 text-xs">
                {connectionError && <p className="text-amber-700">{connectionError}</p>}
                {conferenceError && <p className="text-rose-700">{conferenceError}</p>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4 space-y-4">
            {!supportsLivekit && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                This session type does not support LiveKit conference mode.
              </div>
            )}

            {supportsLivekit && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Live Video Grid</h2>
                  <p className="text-xs text-slate-500">{participantTracks.length} active feed{participantTracks.length === 1 ? '' : 's'}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {conferenceConnected && participantTracks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                      Connected. Waiting for participant media tracks...
                    </div>
                  )}
                  {conferenceConnected && participantTracks.map((item) => (
                    <LivekitTrackTile
                      key={item.key}
                      publication={item.publication}
                      participantName={item.participantName}
                      isLocal={item.isLocal}
                    />
                  ))}
                  {!conferenceConnected && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                      Join the conference to display participant video and audio feeds here.
                    </div>
                  )}
                </div>
              </div>
            )}

            {cameraPermissionBlocked && isVideoSession && conferenceConnected && !isCameraEnabled && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                Camera access is blocked. Click Allow Camera Access and approve the browser prompt, or enable camera access in your browser site settings.
                <div className="mt-2">
                  <button
                    onClick={handleAllowCameraAccess}
                    className="rounded-md bg-amber-600 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-700"
                  >
                    Ask for Camera Access Again
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Session Details</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-semibold">Type:</span> {session?.kind || 'N/A'}</p>
                  <p><span className="font-semibold">Participants:</span> {sessionParticipants.length}</p>
                  <p><span className="font-semibold">Created:</span> {session?.created_at ? new Date(session.created_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">People</h2>
                  {isSessionCreator && availableCandidates.length > 0 && (
                    <button
                      onClick={() => setShowAddParticipantsForm(!showAddParticipantsForm)}
                      className="rounded-lg border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
                    >
                      {showAddParticipantsForm ? '✕ Cancel' : '+ Add Participants'}
                    </button>
                  )}
                </div>

                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {sessionParticipants.length === 0 && <p className="text-sm text-slate-500">No participants available.</p>}
                  {sessionParticipants.map((participant) => (
                    <div
                      key={`${participant.user_id}-${participant.joined_at}`}
                      className={`rounded-lg border px-3 py-2 ${isDark ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {participant.full_name || 'Unknown user'}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                            {participant.role_name || 'member'} {participant.role === 'host' && '(Host)'}
                          </p>
                        </div>
                        {isSessionCreator && participant.role !== 'host' && (
                          <button
                            onClick={() => handleRemoveParticipant(participant.user_id)}
                            disabled={removingParticipantId === participant.user_id}
                            className={`flex-shrink-0 rounded px-2 py-1 text-xs font-semibold transition ${isDark
                              ? 'bg-rose-900 text-rose-200 hover:bg-rose-800'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            title="Remove participant"
                          >
                            {removingParticipantId === participant.user_id ? '...' : '✕'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isSessionCreator && showAddParticipantsForm && availableCandidates.length > 0 && (
                  <div className={`mt-3 rounded-lg border p-3 ${isDark ? 'border-gray-600 bg-gray-700' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {availableCandidates.map((candidate) => (
                        <label
                          key={candidate.id}
                          className={`flex cursor-pointer items-center rounded p-2 transition ${selectedCandidates.includes(candidate.id)
                            ? isDark
                              ? 'bg-cyan-900'
                              : 'bg-cyan-50'
                            : isDark
                              ? 'hover:bg-gray-600'
                              : 'hover:bg-white'
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
                            className="h-4 w-4 rounded"
                          />
                          <span className={`ml-2 text-xs ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                            {candidate.full_name || candidate.email}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={handleAddParticipants}
                      disabled={selectedCandidates.length === 0 || addingParticipants}
                      className="mt-2 w-full rounded-lg bg-cyan-600 px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {addingParticipants ? 'Adding...' : 'Add Selected'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[36rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Helpdesk Chat</p>
                <h2 className="text-lg font-semibold text-slate-900">{session?.title || 'Session Conversation'}</h2>
              </div>
              <Link to="/helpdesk" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                Back to Sessions
              </Link>
            </div>
            {loading && <p className="mt-2 text-xs text-slate-500">Loading chat...</p>}
            {!loading && error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          </div>

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-100 to-slate-50 p-4">
            {!loading && !error && sortedMessages.length === 0 && (
              <p className="text-center text-slate-500">No messages yet. Start the conversation.</p>
            )}
            {!loading &&
              !error &&
              visibleMessages.map((message) => (
                <ChatMessageBubble
                  key={message.id}
                  message={message}
                  isOwn={String(message.sender_id) === String(user?.id)}
                />
              ))}
            <div ref={bottomRef} />
          </div>

          {sendError && <p className="px-4 py-2 text-sm text-rose-700">{sendError}</p>}
          <ChatComposer onSend={handleSend} disabled={!!error || session?.status === 'ended'} />
        </section>
        </div>
      </div>
    </HelpdeskShell>
  );
};

export default ChatPage;
