'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, Radio, Square } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type ChatMessage = {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username?: string | null;
    handle?: string | null;
    verified?: boolean | null;
  }[] | {
    username?: string | null;
    handle?: string | null;
    verified?: boolean | null;
  } | null;
};

function unwrapProfile(
  profile: ChatMessage['profiles'],
): { username?: string | null; handle?: string | null; verified?: boolean | null } | null {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] || null : profile;
}

export function LiveStreamRoom({
  streamId,
  ownerId,
  initialTitle,
  initialDescription,
  initialViewerCount,
  initialMessages,
  userId,
  isOwner,
}: {
  streamId: string;
  ownerId: string;
  initialTitle: string;
  initialDescription: string;
  initialViewerCount: number;
  initialMessages: ChatMessage[];
  userId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMicEnabled(true);
      setCameraEnabled(true);
      setError(null);
    } catch {
      setError('Could not access camera/microphone. Check browser permissions.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSignal(row: {
    sender_id: string;
    recipient_id: string | null;
    kind: string;
    payload: Record<string, unknown>;
  }) {
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

  useEffect(() => {
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
        (payload) => setMessages((prev) => [...prev, payload.new as never]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
        (payload) => {
          const row = payload.new as { is_live?: boolean; viewer_count?: number };
          if (typeof row.viewer_count === 'number') setViewerCount(row.viewer_count);
          if (row.is_live === false) setLiveEnded(true);
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

    return () => {
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
  }, [isOwner, ownerId, streamId, supabase, userId]);

  async function onSendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || liveEnded) return;

    const res = await fetch(`/api/live/streams/${streamId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) setChatInput('');
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
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
          {isOwner ? (
            <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
          ) : (
            <video ref={remoteVideoRef} autoPlay playsInline controls={false} className="aspect-video w-full object-cover" />
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold">{title}</h1>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <Radio className="h-4 w-4" />
              LIVE
            </div>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{description || 'No description.'}</p>
          <p className="mt-2 text-sm text-zinc-500">Viewers: {viewerCount.toLocaleString()}</p>

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
                onClick={() => void endStream()}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                <Square className="h-4 w-4" />
                {ending ? 'Ending…' : 'End Stream'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Live Chat</h2>
        <div className="mt-3 h-[420px] space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {!messages.length ? <p className="text-zinc-500">No messages yet.</p> : null}
          {messages.map((message) => {
            const profile = unwrapProfile(message.profiles);
            return (
              <p key={message.id}>
                <span className="font-semibold">{profile?.username || 'User'}:</span>{' '}
                <span>{message.content}</span>
              </p>
            );
          })}
        </div>
        <form onSubmit={onSendChat} className="mt-3 flex gap-2">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            disabled={liveEnded}
            placeholder={liveEnded ? 'Stream ended' : 'Send a message'}
            className="h-10 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={liveEnded || !chatInput.trim()}
            className="rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            Send
          </button>
        </form>
      </aside>
    </section>
  );
}
