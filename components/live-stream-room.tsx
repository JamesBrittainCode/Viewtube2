'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Square,
  Settings,
  Pin,
  PinOff,
  Trash2,
  ScreenShare,
  ScreenShareOff,
  FlipHorizontal2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { VerifiedBadge } from '@/components/verified-badge';

type ProfileLite = {
  username?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  verified?: boolean | null;
};

type ChatMessage = {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  pinned?: boolean | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  profiles?: {
    username?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
    verified?: boolean | null;
  }[] | {
    username?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
    verified?: boolean | null;
  } | null;
};

function unwrapProfile(
  profile: ChatMessage['profiles'],
): ProfileLite | null {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] || null : profile;
}

function formatChatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function LiveStreamRoom({
  streamId,
  ownerId,
  initialTitle,
  initialDescription,
  initialViewerCount,
  initialStartedAt,
  initialMessages,
  userId,
  isOwner,
  initialChatEnabled,
  initialChatSubscribersOnly,
  initialChatSlowModeSeconds,
}: {
  streamId: string;
  ownerId: string;
  initialTitle: string;
  initialDescription: string;
  initialViewerCount: number;
  initialStartedAt: string;
  initialMessages: ChatMessage[];
  userId: string;
  isOwner: boolean;
  initialChatEnabled: boolean;
  initialChatSubscribersOnly: boolean;
  initialChatSlowModeSeconds: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seenSignalIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Map<string, ProfileLite>>(new Map());
  const lastSignalAtRef = useRef<string>('1970-01-01T00:00:00.000Z');
  const lastMessageAtRef = useRef<string>('1970-01-01T00:00:00.000Z');
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState('');
  const [viewerCount, setViewerCount] = useState(initialViewerCount);
  const [liveEnded, setLiveEnded] = useState(false);
  const [starting, setStarting] = useState(isOwner);
  const [ending, setEnding] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [sharingScreen, setSharingScreen] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const [chatEnabled, setChatEnabled] = useState(initialChatEnabled);
  const [chatSubscribersOnly, setChatSubscribersOnly] = useState(initialChatSubscribersOnly);
  const [chatSlowModeSeconds, setChatSlowModeSeconds] = useState(initialChatSlowModeSeconds);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatActionError, setChatActionError] = useState<string | null>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [removingMessageIds, setRemovingMessageIds] = useState<Set<string>>(new Set());

  const pinnedMessage = useMemo(() => {
    const pinned = messages
      .filter((m) => Boolean(m.pinned) && !Boolean(m.is_deleted))
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    return pinned[0] || null;
  }, [messages]);

  const startedLabel = useMemo(() => {
    const d = new Date(initialStartedAt);
    if (Number.isNaN(d.getTime())) return null;
    return `Started ${formatDistanceToNow(d, { addSuffix: true })}`;
  }, [initialStartedAt]);

  function animateNewMessage(id: string) {
    setNewMessageIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setNewMessageIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 450);
  }

  function animateRemoveMessage(id: string) {
    setRemovingMessageIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setRemovingMessageIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 220);
  }

  async function getProfileLite(targetUserId: string): Promise<ProfileLite | null> {
    const cached = profileCacheRef.current.get(targetUserId);
    if (cached) return cached;
    const { data, error: profErr } = await supabase
      .from('profiles')
      .select('username,handle,avatar_url,verified')
      .eq('id', targetUserId)
      .maybeSingle();
    if (profErr || !data) return null;
    profileCacheRef.current.set(targetUserId, data);
    return data;
  }

  async function enrichMessage(row: ChatMessage): Promise<ChatMessage> {
    if (row.profiles) {
      const p = unwrapProfile(row.profiles);
      if (p && !profileCacheRef.current.get(row.user_id)) {
        profileCacheRef.current.set(row.user_id, p);
      }
      return row;
    }
    const prof = await getProfileLite(row.user_id);
    if (!prof) return row;
    return { ...row, profiles: prof };
  }

  async function sendSignal(recipientId: string | null, kind: string, payload: Record<string, unknown>) {
    const { error: insertError } = await supabase.from('live_signals').insert({
      stream_id: streamId,
      sender_id: userId,
      recipient_id: recipientId,
      kind,
      payload,
    });
    if (insertError) throw insertError;
  }

  async function getCameraVideoTrack(facingMode: 'user' | 'environment') {
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: false,
    });
    const track = camStream.getVideoTracks()[0] || null;
    if (!track) {
      for (const t of camStream.getTracks()) t.stop();
      throw new Error('Could not access camera.');
    }
    for (const t of camStream.getTracks()) {
      if (t !== track) t.stop();
    }
    return track;
  }

  async function replaceOutgoingVideoTrack(newTrack: MediaStreamTrack) {
    const stream = localStreamRef.current;
    if (!stream) return;

    newTrack.enabled = cameraEnabled;

    const oldVideoTracks = stream.getVideoTracks().filter((t) => t.id !== newTrack.id);
    stream.addTrack(newTrack);

    for (const pc of peersRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video') || null;
      if (sender) {
        // eslint-disable-next-line no-await-in-loop
        await sender.replaceTrack(newTrack);
      } else {
        pc.addTrack(newTrack, stream);
      }
    }

    for (const t of oldVideoTracks) {
      try {
        stream.removeTrack(t);
      } catch {
        // ignore
      }
      try {
        t.stop();
      } catch {
        // ignore
      }
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }

  function getOrCreatePeerConnection(partnerId: string) {
    const existing = peersRef.current.get(partnerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal(partnerId, 'ice_candidate', { candidate: event.candidate.toJSON() }).catch(() => {});
    };

    if (isOwner && localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    } else {
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };
    }

    peersRef.current.set(partnerId, pc);
    return pc;
  }

  async function startBroadcastIfOwner() {
    if (!isOwner) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMicEnabled(true);
      setCameraEnabled(true);
      setSharingScreen(false);
      screenTrackRef.current = null;
      setError(null);
    } catch {
      setError('Could not access camera/microphone. Check browser permissions.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSignal(row: {
    id?: string;
    created_at?: string;
    sender_id: string;
    recipient_id: string | null;
    kind: string;
    payload: Record<string, unknown>;
  }) {
    if (row.id && seenSignalIdsRef.current.has(row.id)) return;
    if (row.id) seenSignalIdsRef.current.add(row.id);
    if (row.created_at && row.created_at > lastSignalAtRef.current) {
      lastSignalAtRef.current = row.created_at;
    }
    if (row.sender_id === userId) return;
    if (row.recipient_id && row.recipient_id !== userId) return;

    try {
      if (row.kind === 'viewer_join' && isOwner) {
        const viewerId = row.sender_id;
        const pc = getOrCreatePeerConnection(viewerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(viewerId, 'offer', { sdp: offer.sdp, type: offer.type });
        return;
      }

      if (row.kind === 'offer' && !isOwner) {
        const pc = getOrCreatePeerConnection(ownerId);
        const offer = row.payload as { sdp?: string; type?: RTCSdpType };
        if (!offer.sdp || !offer.type) return;
        await pc.setRemoteDescription(new RTCSessionDescription({ type: offer.type, sdp: offer.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(ownerId, 'answer', { sdp: answer.sdp, type: answer.type });
        return;
      }

      if (row.kind === 'answer' && isOwner) {
        const viewerId = row.sender_id;
        const pc = getOrCreatePeerConnection(viewerId);
        const answer = row.payload as { sdp?: string; type?: RTCSdpType };
        if (!answer.sdp || !answer.type) return;
        await pc.setRemoteDescription(new RTCSessionDescription({ type: answer.type, sdp: answer.sdp }));
        return;
      }

      if (row.kind === 'ice_candidate') {
        const partnerId = isOwner ? row.sender_id : ownerId;
        const pc = getOrCreatePeerConnection(partnerId);
        const candidate = (row.payload as { candidate?: RTCIceCandidateInit }).candidate;
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        return;
      }

      if (row.kind === 'stream_ended') {
        setLiveEnded(true);
      }
    } catch (err) {
      setError((err as Error).message || 'Live signaling failed.');
    }
  }

  async function pollSignals() {
    const { data, error } = await supabase
      .from('live_signals')
      .select('id,sender_id,recipient_id,kind,payload,created_at')
      .eq('stream_id', streamId)
      .gt('created_at', lastSignalAtRef.current)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error || !data?.length) return;
    for (const row of data) {
      await handleSignal(row);
    }
  }

  async function pollMessages() {
    const { data, error } = await supabase
      .from('live_chat_messages')
      .select(
        'id,stream_id,user_id,content,pinned,is_deleted,deleted_at,deleted_by,created_at,profiles:profiles!live_chat_messages_user_id_fkey(username,handle,avatar_url,verified)',
      )
      .eq('stream_id', streamId)
      .gt('created_at', lastMessageAtRef.current)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error || !data?.length) return;
    setMessages((prev) => {
      const merged = [...prev];
      const index = new Map(merged.map((m, i) => [m.id, i]));
      for (const row of data) {
        const next = row as never as ChatMessage;
        const existingIdx = index.get(next.id);
        if (existingIdx !== undefined) {
          merged[existingIdx] = next;
        } else {
          seenMessageIdsRef.current.add(next.id);
          const p = unwrapProfile(next.profiles);
          if (p && !profileCacheRef.current.get(next.user_id)) {
            profileCacheRef.current.set(next.user_id, p);
          }
          merged.push(next);
          index.set(next.id, merged.length - 1);
        }
        if (row.created_at > lastMessageAtRef.current) {
          lastMessageAtRef.current = row.created_at;
        }
      }
      return merged;
    });
  }

  async function pollChatSnapshot() {
    // Snapshot refresh to catch UPDATEs even if Realtime is misconfigured.
    const res = await fetch(`/api/live/streams/${streamId}/chat`, { cache: 'no-store' });
    if (!res.ok) return;
    const payload = (await res.json()) as { messages?: ChatMessage[] };
    const next = payload.messages || [];
    if (!next.length) return;

    // Keep lastMessageAt in sync.
    for (const row of next) {
      if (row.id) seenMessageIdsRef.current.add(row.id);
      if (row.created_at && row.created_at > lastMessageAtRef.current) {
        lastMessageAtRef.current = row.created_at;
      }
      const p = unwrapProfile(row.profiles);
      if (p && !profileCacheRef.current.get(row.user_id)) {
        profileCacheRef.current.set(row.user_id, p);
      }
    }

    setMessages((prev) => {
      // Replace-by-id merge to preserve local animation states.
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const row of next) {
        map.set(row.id, row);
      }
      return Array.from(map.values()).sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    });
  }

  async function pollStreamState() {
    const res = await fetch(`/api/live/streams/${streamId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const payload = (await res.json()) as {
      stream?: { viewer_count?: number; is_live?: boolean };
    };
    const next = payload.stream;
    if (!next) return;
    if (typeof next.viewer_count === 'number') setViewerCount(next.viewer_count);
    if (next.is_live === false) setLiveEnded(true);
  }

  useEffect(() => {
    for (const item of initialMessages) {
      if (item.id) seenMessageIdsRef.current.add(item.id);
      if (item.created_at && item.created_at > lastMessageAtRef.current) {
        lastMessageAtRef.current = item.created_at;
      }
      const p = unwrapProfile(item.profiles);
      if (p && !profileCacheRef.current.get(item.user_id)) {
        profileCacheRef.current.set(item.user_id, p);
      }
    }

    if (isOwner) void startBroadcastIfOwner();

    const channel = supabase
      .channel(`live-room-${streamId}-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_signals', filter: `stream_id=eq.${streamId}` },
        (payload) => void handleSignal(payload.new as never),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const base = payload.new as ChatMessage;
          if (base.id && seenMessageIdsRef.current.has(base.id)) return;
          if (base.id) seenMessageIdsRef.current.add(base.id);
          if (base.created_at && base.created_at > lastMessageAtRef.current) {
            lastMessageAtRef.current = base.created_at;
          }
          void enrichMessage(base).then((msg) => {
            setMessages((prev) => [...prev, msg]);
            if (msg.id) animateNewMessage(msg.id);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const next = payload.new as ChatMessage;
          if (!next?.id) return;
          if (next.is_deleted) {
            animateRemoveMessage(next.id);
            return;
          }
          void enrichMessage(next).then((msg) => {
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === msg.id);
              if (idx === -1) return prev;
              const copy = [...prev];
              copy[idx] = msg;
              return copy;
            });
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
        (payload) => {
          const row = payload.new as { is_live?: boolean; viewer_count?: number; chat_enabled?: boolean; chat_subscribers_only?: boolean; chat_slow_mode_seconds?: number };
          if (typeof row.viewer_count === 'number') setViewerCount(row.viewer_count);
          if (row.is_live === false) setLiveEnded(true);
          if (typeof row.chat_enabled === 'boolean') setChatEnabled(row.chat_enabled);
          if (typeof row.chat_subscribers_only === 'boolean') setChatSubscribersOnly(row.chat_subscribers_only);
          if (typeof row.chat_slow_mode_seconds === 'number') setChatSlowModeSeconds(row.chat_slow_mode_seconds);
        },
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        if (isOwner) return;

        await fetch(`/api/live/streams/${streamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join' }),
        });
        await sendSignal(ownerId, 'viewer_join', { stream_id: streamId });
      });

    channelRef.current = channel;

    const timer = setInterval(() => {
      void pollSignals();
      void pollMessages();
      void pollStreamState();
    }, 700);

    const snapshotTimer = setInterval(() => {
      void pollChatSnapshot();
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(snapshotTimer);
      if (!isOwner) {
        void fetch(`/api/live/streams/${streamId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'leave' }),
        }).catch(() => {});
      }

      for (const peer of peersRef.current.values()) {
        peer.close();
      }
      peersRef.current.clear();

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      localStreamRef.current = null;

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [initialMessages, isOwner, ownerId, streamId, supabase, userId]);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = chatViewportRef.current;
    if (!el) return;
    const t = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(t);
  }, [messages.length, stickToBottom]);

  function onChatScroll() {
    const el = chatViewportRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
    setStickToBottom(atBottom);
  }

  async function onSendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || liveEnded) return;
    if (!chatEnabled && !isOwner) {
      setChatActionError('Chat is disabled by the creator.');
      return;
    }

    const res = await fetch(`/api/live/streams/${streamId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const text = await res.text();
    let payload: { message?: ChatMessage; error?: string } = {};
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      payload = { error: text || 'Request failed' };
    }

    if (res.ok) {
      if (payload.message?.id && !seenMessageIdsRef.current.has(payload.message.id)) {
        seenMessageIdsRef.current.add(payload.message.id);
        const p = unwrapProfile(payload.message.profiles);
        if (p && !profileCacheRef.current.get(payload.message.user_id)) {
          profileCacheRef.current.set(payload.message.user_id, p);
        }
        setMessages((prev) => [...prev, payload.message!]);
      }
      if (payload.message?.created_at && payload.message.created_at > lastMessageAtRef.current) {
        lastMessageAtRef.current = payload.message.created_at;
      }
      setChatInput('');
      setChatActionError(null);
    } else {
      setChatActionError(payload.error || 'Could not send message.');
    }
  }

  async function saveChatSettings(next: {
    enabled: boolean;
    subscribersOnly: boolean;
    slowModeSeconds: number;
  }) {
    setChatActionError(null);
    const res = await fetch(`/api/live/streams/${streamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'settings',
        chat_enabled: next.enabled,
        chat_subscribers_only: next.subscribersOnly,
        chat_slow_mode_seconds: next.slowModeSeconds,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      setChatActionError(text || 'Could not save chat settings.');
      return;
    }
    setChatEnabled(next.enabled);
    setChatSubscribersOnly(next.subscribersOnly);
    setChatSlowModeSeconds(next.slowModeSeconds);
    setChatSettingsOpen(false);
  }

  async function moderateMessage(messageId: string, action: 'pin' | 'unpin' | 'delete') {
    setChatActionError(null);

    // Optimistic UI so the pinned bubble updates immediately for the creator.
    if (action === 'pin') {
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          pinned: m.id === messageId,
        })),
      );
    }
    if (action === 'unpin') {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pinned: false } : m)));
    }

    const res = await fetch(`/api/live/streams/${streamId}/chat/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const text = await res.text();
      setChatActionError(text || 'Could not update message.');
      // Re-sync state if the server rejected the optimistic update.
      void pollChatSnapshot();
      return;
    }
    if (action === 'delete') {
      animateRemoveMessage(messageId);
      // Others should see it via Realtime UPDATE. Snapshot polling is a fallback.
    }
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micEnabled;
    for (const track of stream.getAudioTracks()) {
      track.enabled = next;
    }
    setMicEnabled(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraEnabled;
    for (const track of stream.getVideoTracks()) {
      track.enabled = next;
    }
    setCameraEnabled(next);
  }

  async function flipCamera() {
    if (!isOwner || liveEnded) return;
    if (sharingScreen) {
      setError('Stop screen sharing before flipping the camera.');
      return;
    }
    setError(null);
    const nextFacing: 'user' | 'environment' = cameraFacing === 'user' ? 'environment' : 'user';
    try {
      const track = await getCameraVideoTrack(nextFacing);
      await replaceOutgoingVideoTrack(track);
      setCameraFacing(nextFacing);
    } catch (err) {
      setError((err as Error).message || 'Could not flip camera.');
    }
  }

  async function startScreenShare() {
    if (!isOwner || liveEnded) return;
    if (typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      setError('Screen sharing is not supported on this device/browser.');
      return;
    }
    setError(null);
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = display.getVideoTracks()[0] || null;
      if (!track) throw new Error('Could not start screen sharing.');

      screenTrackRef.current = track;
      setSharingScreen(true);

      track.onended = () => {
        void stopScreenShare();
      };

      await replaceOutgoingVideoTrack(track);
    } catch (err) {
      setSharingScreen(false);
      screenTrackRef.current = null;
      setError((err as Error).message || 'Could not start screen sharing.');
    }
  }

  async function stopScreenShare() {
    if (!isOwner) return;
    if (!sharingScreen) return;
    setError(null);
    setSharingScreen(false);
    const prev = screenTrackRef.current;
    screenTrackRef.current = null;
    try {
      if (prev) prev.stop();
    } catch {
      // ignore
    }
    try {
      const track = await getCameraVideoTrack(cameraFacing);
      track.enabled = cameraEnabled;
      await replaceOutgoingVideoTrack(track);
    } catch (err) {
      setError((err as Error).message || 'Could not restore camera after screen share.');
    }
  }

  async function endStream() {
    if (!isOwner || ending) return;
    setEnding(true);
    try {
      await fetch(`/api/live/streams/${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', title, description }),
      });
      await sendSignal(null, 'stream_ended', {});
      setLiveEnded(true);
      router.refresh();
    } finally {
      setEnding(false);
    }
  }

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
          <div className="relative">
            {isOwner ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                controls={false}
                className="aspect-video w-full object-cover"
              />
            )}
          </div>

          {/* Live edge timeline (UI parity with regular player). */}
          <div className="space-y-2 bg-zinc-950/80 px-3 py-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={1}
              readOnly
              disabled
              style={{
                background: 'linear-gradient(to right, #ef4444 0%, #ef4444 100%, #3f3f46 100%, #3f3f46 100%)',
              }}
              className="h-1.5 w-full appearance-none rounded-full opacity-95 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:bg-red-500 [&::-webkit-slider-thumb]:bg-red-500"
            />
            <div className="flex items-center justify-end">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                LIVE
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <Radio className="h-4 w-4" />
              LIVE
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
            <p>Viewers: {viewerCount.toLocaleString()}</p>
            {startedLabel ? <p>{startedLabel}</p> : null}
          </div>

          {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
          {starting ? <p className="mt-2 text-sm text-zinc-500">Starting camera and microphone…</p> : null}
          {liveEnded ? <p className="mt-2 text-sm text-red-500">This stream has ended.</p> : null}

          {isOwner && !liveEnded ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                {micEnabled ? 'Mute Mic' : 'Unmute Mic'}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                {cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
              </button>
              <button
                type="button"
                onClick={() => void flipCamera()}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                title="Flip camera (mobile)"
              >
                <FlipHorizontal2 className="h-4 w-4" />
                Flip Camera
              </button>
              <button
                type="button"
                onClick={() => void (sharingScreen ? stopScreenShare() : startScreenShare())}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                title="Share screen"
              >
                {sharingScreen ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
                {sharingScreen ? 'Stop Share' : 'Share Screen'}
              </button>
              <button
                type="button"
                onClick={() => void endStream()}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                <Square className="h-4 w-4" />
                {ending ? 'Ending…' : 'End Stream'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</h3>
          <p className="mt-2 whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">
            {description || 'No description.'}
          </p>
        </div>
      </div>

      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 lg:sticky lg:top-20 lg:self-start dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Live Chat</h2>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <button
                type="button"
                onClick={() => setChatSettingsOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                title="Chat settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const el = chatViewportRef.current;
                if (!el) return;
                el.scrollTop = el.scrollHeight;
                setStickToBottom(true);
              }}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Jump to latest
            </button>
          </div>
        </div>

        {pinnedMessage ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500">
                <Pin className="h-3.5 w-3.5" />
                Pinned message
              </p>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => void moderateMessage(pinnedMessage.id, 'unpin')}
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Unpin
                </button>
              ) : null}
            </div>
            {(() => {
              const profile = unwrapProfile(pinnedMessage.profiles);
              const name = profile?.username || 'User';
              const handle = profile?.handle || null;
              return (
                <div className="mt-2 flex items-start gap-2">
                  <Link
                    href={`/channel/${encodeURIComponent(handle || name)}`}
                    className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                    title={handle || name}
                  >
                    <Image
                      src={profile?.avatar_url || '/avatar-placeholder.svg'}
                      alt={name}
                      width={28}
                      height={28}
                      className="h-7 w-7 object-cover"
                    />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <Link
                        href={`/channel/${encodeURIComponent(handle || name)}`}
                        className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {name}
                      </Link>
                      {profile?.verified ? <VerifiedBadge className="h-4 w-4 text-zinc-500" /> : null}
                      {handle ? <span className="text-[11px] text-zinc-500">{handle}</span> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-zinc-800 dark:text-zinc-100">
                      {pinnedMessage.content}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}

        <div
          ref={chatViewportRef}
          onScroll={onChatScroll}
          className="mt-3 h-[420px] space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {!messages.length ? <p className="text-zinc-500">No messages yet.</p> : null}
          {messages.map((message) => {
            const profile = unwrapProfile(message.profiles);
            const name = profile?.username || 'User';
            const handle = profile?.handle || null;
            const time = formatChatTime(message.created_at);
            const isHost = message.user_id === ownerId;
            const deleted = Boolean(message.is_deleted);
            const isPinned = Boolean(message.pinned) && !deleted;
            const isNew = newMessageIds.has(message.id);
            const isRemoving = removingMessageIds.has(message.id);

            return (
              <div
                key={message.id}
                className={[
                  'group flex gap-2 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                  isNew ? 'motion-safe:animate-[vtMsgIn_220ms_ease-out]' : '',
                  isRemoving ? 'pointer-events-none opacity-0 translate-y-1' : '',
                ].join(' ')}
              >
                <Link
                  href={`/channel/${encodeURIComponent(handle || name)}`}
                  className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                >
                  <Image
                    src={profile?.avatar_url || '/avatar-placeholder.svg'}
                    alt={name}
                    width={32}
                    height={32}
                    className="h-8 w-8 object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <Link
                      href={`/channel/${encodeURIComponent(handle || name)}`}
                      className={`text-xs font-semibold hover:underline ${
                        isHost ? 'text-red-700 dark:text-red-300' : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {name}
                    </Link>
                    {profile?.verified ? <VerifiedBadge className="h-4 w-4 text-zinc-500" /> : null}
                    {isHost ? (
                      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                        Host
                      </span>
                    ) : null}
                    {isPinned ? (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        <Pin className="h-3 w-3" />
                        Pinned
                      </span>
                    ) : null}
                    {time ? <span className="ml-1 text-[11px] text-zinc-500">{time}</span> : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-100">
                    {deleted ? (
                      <span className="text-zinc-500 italic">Message deleted by creator.</span>
                    ) : (
                      message.content
                    )}
                  </p>
                </div>

                {isOwner && !deleted ? (
                  <div className="mt-0.5 flex items-start gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none">
                    <button
                      type="button"
                      onClick={() => void moderateMessage(message.id, isPinned ? 'unpin' : 'pin')}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-800 dark:hover:bg-zinc-950"
                      title={isPinned ? 'Unpin' : 'Pin'}
                    >
                      {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void moderateMessage(message.id, 'delete')}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-white hover:text-red-700 dark:hover:border-zinc-800 dark:hover:bg-zinc-950 dark:hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {chatActionError ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{chatActionError}</p> : null}

        {!chatEnabled && !isOwner ? (
          <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            Chat is disabled by the creator.
          </p>
        ) : null}

        <form onSubmit={onSendChat} className="mt-3 flex gap-2">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            disabled={liveEnded || (!chatEnabled && !isOwner)}
            placeholder={
              liveEnded
                ? 'Stream ended'
                : !chatEnabled && !isOwner
                  ? 'Chat disabled'
                  : chatSubscribersOnly && !isOwner
                    ? 'Subscribers-only chat'
                    : chatSlowModeSeconds > 0 && !isOwner
                      ? `Slow mode: ${chatSlowModeSeconds}s`
                      : 'Send a message'
            }
            className="h-10 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={liveEnded || (!chatEnabled && !isOwner) || !chatInput.trim()}
            className="rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            Send
          </button>
        </form>

        {chatSettingsOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onMouseDown={() => setChatSettingsOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Chat settings</h3>
                <button
                  type="button"
                  onClick={() => setChatSettingsOpen(false)}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <label className="flex items-center justify-between gap-3">
                  <span className="font-medium">Enable chat</span>
                  <input
                    type="checkbox"
                    checked={chatEnabled}
                    onChange={(e) => setChatEnabled(e.target.checked)}
                    className="h-4 w-4 accent-red-600"
                  />
                </label>

                <label className="flex items-center justify-between gap-3">
                  <span className="font-medium">Subscribers-only</span>
                  <input
                    type="checkbox"
                    checked={chatSubscribersOnly}
                    onChange={(e) => setChatSubscribersOnly(e.target.checked)}
                    className="h-4 w-4 accent-red-600"
                  />
                </label>

                <label className="flex items-center justify-between gap-3">
                  <span className="font-medium">Slow mode</span>
                  <select
                    value={chatSlowModeSeconds}
                    onChange={(e) => setChatSlowModeSeconds(Number(e.target.value) || 0)}
                    className="h-10 rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value={0}>Off</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    void saveChatSettings({
                      enabled: chatEnabled,
                      subscribersOnly: chatSubscribersOnly,
                      slowModeSeconds: chatSlowModeSeconds,
                    })
                  }
                  className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  Save settings
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </section>
  );
}
