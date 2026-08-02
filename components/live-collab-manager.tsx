'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CalendarClock, Check, Clapperboard, Loader2, Radio, Send, Users, X } from 'lucide-react';
import { emitStreakEvent } from '@/lib/streak-events';

type ProfileLite = {
  id: string;
  username?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  can_stream_live?: boolean | null;
};

type CollabInvite = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  stream_id?: string | null;
  title: string;
  description: string;
  scheduled_for: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string;
  inviter?: ProfileLite | null;
  invitee?: ProfileLite | null;
};

type WatchParty = {
  id: string;
  title: string;
  description: string;
  scheduled_for: string;
  status: string;
  video_id: string;
  videos?: {
    id: string;
    title?: string | null;
    thumbnail_url?: string | null;
  } | null;
};

function localDateValue(offsetMinutes = 60) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function formatScheduled(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function displayName(profile?: ProfileLite | null) {
  return profile?.username || profile?.handle || 'ViewTube creator';
}

function Avatar({ profile }: { profile?: ProfileLite | null }) {
  return (
    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
      {profile?.avatar_url ? (
        <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="40px" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-300">
          {displayName(profile).slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export function LiveCollabManager({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const [invites, setInvites] = useState<CollabInvite[]>([]);
  const [parties, setParties] = useState<WatchParty[]>([]);
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('Live together on ViewTube');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledFor, setScheduledFor] = useState(localDateValue());
  const [partyVideoId, setPartyVideoId] = useState('');
  const [partyTitle, setPartyTitle] = useState('Watch party');
  const [partyScheduledFor, setPartyScheduledFor] = useState(localDateValue(90));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incoming = useMemo(
    () => invites.filter((invite) => invite.invitee_id === currentUserId && invite.status === 'pending'),
    [currentUserId, invites],
  );
  const accepted = useMemo(
    () => invites.filter((invite) => invite.inviter_id === currentUserId && invite.status === 'accepted'),
    [currentUserId, invites],
  );

  async function loadAll() {
    const [inviteRes, partyRes] = await Promise.all([
      fetch('/api/live/collab-invites', { cache: 'no-store' }),
      fetch('/api/live/watch-parties', { cache: 'no-store' }),
    ]);
    const invitePayload = (await inviteRes.json().catch(() => ({}))) as { invites?: CollabInvite[]; error?: string };
    const partyPayload = (await partyRes.json().catch(() => ({}))) as { parties?: WatchParty[]; error?: string };
    if (!inviteRes.ok) throw new Error(invitePayload.error || 'Could not load live invites.');
    if (!partyRes.ok) throw new Error(partyPayload.error || 'Could not load watch parties.');
    setInvites(invitePayload.invites || []);
    setParties(partyPayload.parties || []);
  }

  useEffect(() => {
    void loadAll().catch((err) => setError((err as Error).message));
  }, []);

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/live/collab-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitee: target,
          title,
          description,
          message,
          scheduled_for: new Date(scheduledFor).toISOString(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Could not send invite.');
      setTarget('');
      setMessage('');
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, action: 'accept' | 'decline' | 'cancel') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/collab-invites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Could not update invite.');
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startCollab(invite: CollabInvite) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/live/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collabInviteId: invite.id }),
      });
      const payload = (await res.json().catch(() => ({}))) as { stream?: { id: string }; streak?: unknown; error?: string };
      if (!res.ok || !payload.stream) throw new Error(payload.error || 'Could not start co-live.');
      emitStreakEvent(payload.streak);
      router.push(`/live/${payload.stream.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createWatchParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const videoId = partyVideoId.trim().split('/').filter(Boolean).pop() || partyVideoId.trim();
      const res = await fetch('/api/live/watch-parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          title: partyTitle,
          scheduled_for: new Date(partyScheduledFor).toISOString(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || 'Could not schedule watch party.');
      setPartyVideoId('');
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5 text-red-400" />
            Go live together
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Schedule a two-creator stream. The other creator gets an email and both accounts must be live-eligible.
          </p>
        </div>
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-200">
          Approval required
        </span>
      </div>

      {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}

      <form onSubmit={sendInvite} className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-zinc-200">Creator handle or email</span>
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="@creator or email"
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-zinc-200">Date and time</span>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3"
            />
          </label>
        </div>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Stream title"
          maxLength={120}
          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Stream description"
          rows={2}
          maxLength={1000}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3"
        />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Optional note to the creator"
          rows={2}
          maxLength={500}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send invite
        </button>
      </form>

      {incoming.length ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="mb-3 font-semibold">Invites waiting for you</h3>
          <div className="space-y-3">
            {incoming.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-900 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar profile={invite.inviter} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{invite.title}</p>
                    <p className="text-sm text-zinc-400">
                      {displayName(invite.inviter)} · {formatScheduled(invite.scheduled_for)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void respond(invite.id, 'accept')} disabled={busy} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-zinc-950">
                    <Check className="mr-1 inline h-4 w-4" /> Accept
                  </button>
                  <button onClick={() => void respond(invite.id, 'decline')} disabled={busy} className="rounded-full border border-zinc-700 px-3 py-2 text-sm font-semibold">
                    <X className="mr-1 inline h-4 w-4" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {accepted.length ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="mb-3 font-semibold">Ready to start together</h3>
          <div className="space-y-3">
            {accepted.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-900 p-3">
                <div>
                  <p className="font-semibold">{invite.title}</p>
                  <p className="text-sm text-zinc-400">
                    With {displayName(invite.invitee)} · {formatScheduled(invite.scheduled_for)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void startCollab(invite)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  <Radio className="h-4 w-4" />
                  Start co-live
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Clapperboard className="h-4 w-4 text-red-300" />
          Watch parties
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Schedule a live hangout around a ViewTube video. Paste the video ID or a ViewTube watch URL.
        </p>
        <form onSubmit={createWatchParty} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={partyTitle}
            onChange={(event) => setPartyTitle(event.target.value)}
            placeholder="Watch party title"
            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3 md:col-span-3"
          />
          <input
            value={partyVideoId}
            onChange={(event) => setPartyVideoId(event.target.value)}
            placeholder="Video ID or watch URL"
            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3"
          />
          <input
            type="datetime-local"
            value={partyScheduledFor}
            onChange={(event) => setPartyScheduledFor(event.target.value)}
            className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 px-3"
          />
          <button type="submit" disabled={busy} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">
            <CalendarClock className="mr-1 inline h-4 w-4" /> Schedule
          </button>
        </form>
        {parties.length ? (
          <div className="mt-3 grid gap-2">
            {parties.slice(0, 3).map((party) => (
              <div key={party.id} className="rounded-xl bg-zinc-900 p-3 text-sm">
                <p className="font-semibold">{party.title}</p>
                <p className="text-zinc-400">
                  {party.videos?.title || party.video_id} · {formatScheduled(party.scheduled_for)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
