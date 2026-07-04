'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Ban, Copy, KeyRound, Link2, QrCode, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

type Profile = {
  id: string;
  username?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  verified?: boolean | null;
  is_admin?: boolean | null;
  subscribers_count?: number | null;
};

type FamilyChild = {
  id: string;
  child_id: string;
  allow_post_content: boolean;
  allow_comments: boolean;
  allow_messages: boolean;
  child?: Profile | null;
  blockedChannels?: Array<{
    id: string;
    blocked_channel_id: string;
    channel?: Profile | null;
  }>;
};

type FamilyParent = {
  id: string;
  parent?: Profile | null;
  allow_post_content: boolean;
  allow_comments: boolean;
  allow_messages: boolean;
};

type LinkCode = {
  code: string;
  expires_at: string;
};

export function LinkedAccountsSettings({ initialKey = '' }: { initialKey?: string }) {
  const [code, setCode] = useState<LinkCode | null>(null);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [parents, setParents] = useState<FamilyParent[]>([]);
  const [linkKey, setLinkKey] = useState(initialKey);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [channelQuery, setChannelQuery] = useState('');
  const [channelResults, setChannelResults] = useState<Profile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const qrUrl = useMemo(() => {
    if (!code?.code || typeof window === 'undefined') return '';
    const link = `${window.location.origin}/studio/settings/linked-accounts?key=${encodeURIComponent(code.code)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=16&data=${encodeURIComponent(link)}`;
  }, [code?.code]);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/family-links', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error || 'Could not load linked accounts.');
      return;
    }
    setCode(data.code || null);
    setChildren(data.children || []);
    setParents(data.parents || []);
    if (!selectedChildId && data.children?.[0]?.child_id) setSelectedChildId(data.children[0].child_id);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(action: string, payload: Record<string, unknown> = {}) {
    setStatus(null);
    const res = await fetch('/api/family-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.');
      return null;
    }
    await load();
    return data;
  }

  async function generateCode() {
    const data = await post('generateCode');
    if (data?.code) {
      setCode(data.code);
      setStatus('New parent link key generated. It expires in 15 minutes.');
    }
  }

  async function linkAccount() {
    const data = await post('linkWithCode', { code: linkKey });
    if (data?.link) {
      setLinkKey('');
      setStatus('Accounts linked. You can now manage settings for that child account.');
    }
  }

  async function updateControls(child: FamilyChild, patch: Partial<FamilyChild>) {
    await post('updateControls', {
      linkId: child.id,
      allowPostContent: patch.allow_post_content ?? child.allow_post_content,
      allowComments: patch.allow_comments ?? child.allow_comments,
      allowMessages: patch.allow_messages ?? child.allow_messages,
    });
  }

  async function searchChannels(value: string) {
    setChannelQuery(value);
    if (value.trim().length < 2) {
      setChannelResults([]);
      return;
    }
    const res = await fetch(`/api/family-links/channel-search?q=${encodeURIComponent(value)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    setChannelResults(res.ok ? data.channels || [] : []);
  }

  const selectedChild = children.find((child) => child.child_id === selectedChildId) || children[0] || null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-sky-300" />
          <div>
            <h1 className="text-3xl font-bold">Linked accounts</h1>
            <p className="mt-2 text-zinc-400">
              Connect parent and child accounts, then manage posting, comments, messages, and blocked channels.
            </p>
          </div>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {status}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-zinc-300" />
            <h2 className="text-xl font-bold">Child account: show parent this code</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Generate this on the child’s account. A parent can scan the QR code or enter the key within 15 minutes.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-[240px_1fr]">
            <div className="grid min-h-[240px] place-items-center rounded-2xl border border-zinc-700 bg-white p-3">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="Parent link QR code" className="h-[220px] w-[220px]" />
              ) : (
                <QrCode className="h-16 w-16 text-zinc-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-400">One-time key</p>
              <div className="mt-2 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 font-mono text-3xl font-black tracking-[0.25em]">
                {code?.code || '— — — —'}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {code?.expires_at ? `Expires ${new Date(code.expires_at).toLocaleTimeString()}` : 'No active key yet.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={generateCode} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950">
                  <RefreshCw className="h-4 w-4" />
                  Generate key
                </button>
                <button
                  type="button"
                  onClick={() => code?.code && navigator.clipboard.writeText(code.code)}
                  disabled={!code?.code}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-zinc-300" />
            <h2 className="text-xl font-bold">Parent account: link with key</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Scan the child’s QR code or enter their one-time key here. Keys refresh every 15 minutes.
          </p>
          <div className="mt-5 flex gap-2">
            <input
              value={linkKey}
              onChange={(event) => setLinkKey(event.target.value.toUpperCase().slice(0, 10))}
              placeholder="9-character key"
              className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono tracking-[0.2em] outline-none focus:border-sky-400"
            />
            <button onClick={linkAccount} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 font-bold text-white hover:bg-sky-400">
              <Link2 className="h-4 w-4" />
              Link
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold">Parent controls</h2>
        {loading ? <p className="mt-3 text-sm text-zinc-500">Loading...</p> : null}
        {!children.length && !loading ? (
          <p className="mt-3 text-sm text-zinc-500">No child accounts linked yet.</p>
        ) : null}
        <div className="mt-5 grid gap-5">
          {children.map((child) => (
            <div key={child.id} className="rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ProfilePill profile={child.child} fallback="Child account" />
                <button onClick={() => post('unlink', { linkId: child.id })} className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">
                  <Trash2 className="h-4 w-4" />
                  Unlink
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <ControlToggle label="Can post content" checked={child.allow_post_content} onChange={(value) => updateControls(child, { allow_post_content: value })} />
                <ControlToggle label="Can comment" checked={child.allow_comments} onChange={(value) => updateControls(child, { allow_comments: value })} />
                <ControlToggle label="Can access messages" checked={child.allow_messages} onChange={(value) => updateControls(child, { allow_messages: value })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-red-300" />
          <h2 className="text-xl font-bold">Blocked channels</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-400">Choose a linked child, search for a channel, then block it.</p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[260px_1fr]">
          <select
            value={selectedChildId}
            onChange={(event) => setSelectedChildId(event.target.value)}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
          >
            {children.map((child) => (
              <option key={child.child_id} value={child.child_id}>
                {child.child?.username || child.child?.handle || 'Child account'}
              </option>
            ))}
          </select>
          <input
            value={channelQuery}
            onChange={(event) => searchChannels(event.target.value)}
            placeholder="Search by handle or display name"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-red-400"
          />
        </div>

        {channelResults.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {channelResults.map((channel) => (
              <button
                key={channel.id}
                onClick={() => selectedChild && post('blockChannel', { childId: selectedChild.child_id, channelId: channel.id })}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-left hover:border-red-400"
              >
                <ProfilePill profile={channel} fallback="Channel" />
                <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">Block</span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedChild?.blockedChannels?.length ? (
          <div className="mt-5 space-y-2">
            {selectedChild.blockedChannels.map((block) => (
              <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-3">
                <ProfilePill profile={block.channel} fallback="Blocked channel" />
                <button onClick={() => post('unblockChannel', { channelId: block.id })} className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-zinc-500">No blocked channels for this child yet.</p>
        )}
      </section>

      {parents.length ? (
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <h2 className="text-xl font-bold">Parents linked to this account</h2>
          <div className="mt-4 grid gap-3">
            {parents.map((parent) => (
              <div key={parent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
                <ProfilePill profile={parent.parent} fallback="Parent account" />
                <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span>Posting: {parent.allow_post_content ? 'On' : 'Off'}</span>
                  <span>Comments: {parent.allow_comments ? 'On' : 'Off'}</span>
                  <span>Messages: {parent.allow_messages ? 'On' : 'Off'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProfilePill({ profile, fallback }: { profile?: Profile | null; fallback: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Image
        src={profile?.avatar_url || '/avatar-placeholder.svg'}
        alt={profile?.username || fallback}
        width={42}
        height={42}
        className="h-10 w-10 rounded-full object-cover"
      />
      <span className="min-w-0">
        <span className="block truncate font-bold">{profile?.username || fallback}</span>
        <span className="block truncate text-xs text-zinc-500">{profile?.handle || 'No handle'}</span>
      </span>
    </span>
  );
}

function ControlToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-sky-500" />
    </label>
  );
}
