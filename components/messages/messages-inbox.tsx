'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { displayHandle } from '@/lib/handle';

type Profile = {
  id: string;
  username: string | null;
  handle: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  is_admin?: boolean | null;
};

type Participant = {
  user_id: string;
  status: string;
  profile: Profile | null;
};

type Thread = {
  id: string;
  title: string | null;
  is_admin_thread: boolean;
  is_broadcast: boolean;
  updated_at: string;
  my_participant?: { status?: string } | null;
  participants: Participant[];
  latest_message: { body: string; created_at: string; is_admin_message?: boolean } | null;
};

function otherParticipant(thread: Thread, currentUserId?: string) {
  return thread.participants.find((item) => item.user_id !== currentUserId) || thread.participants[0] || null;
}

export function MessagesInbox({ currentUserId }: { currentUserId: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [sendToAdmin, setSendToAdmin] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function loadThreads() {
    setLoading(true);
    const res = await fetch('/api/messages', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as { threads?: Thread[]; error?: string };
    if (res.ok) setThreads(data.threads || []);
    else setStatus(data.error || 'Could not load messages.');
    setLoading(false);
  }

  useEffect(() => {
    void loadThreads();
  }, []);

  const pendingCount = useMemo(
    () => threads.filter((thread) => thread.my_participant?.status === 'pending').length,
    [threads],
  );

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, toAdmin: sendToAdmin, message }),
    });
    const data = (await res.json().catch(() => ({}))) as { threadId?: string; error?: string };
    if (!res.ok || !data.threadId) {
      setStatus(data.error || 'Could not send message.');
      return;
    }
    setTarget('');
    setMessage('');
    setSendToAdmin(false);
    window.location.href = `/messages/${data.threadId}`;
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[360px_1fr]">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Messages</h1>
            <p className="text-sm text-zinc-500">
              {pendingCount ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} waiting` : 'DMs and admin messages live here.'}
            </p>
          </div>
          <span className="rounded-full bg-sky-500/10 p-3 text-sky-400">
            <MessageCircle className="h-6 w-6" />
          </span>
        </div>

        <form onSubmit={sendMessage} className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={sendToAdmin}
              onChange={(event) => setSendToAdmin(event.target.checked)}
              className="h-4 w-4 accent-red-500"
            />
            Message ViewTube Admin
          </label>
          {!sendToAdmin ? (
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="@handle or email"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          ) : null}
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your message..."
            rows={4}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">
            <Send className="h-4 w-4" />
            Send message
          </button>
          {status ? <p className="text-sm text-red-400">{status}</p> : null}
        </form>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading messages...</div>
        ) : threads.length ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {threads.map((thread) => {
              const other = otherParticipant(thread, currentUserId);
              const profile = other?.profile;
              const title = thread.title || profile?.username || displayHandle(profile?.handle);
              const isPending = thread.my_participant?.status === 'pending';
              return (
                <Link
                  key={thread.id}
                  href={`/messages/${thread.id}`}
                  className="flex gap-4 rounded-2xl p-4 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <Image
                    src={profile?.avatar_url || '/avatar-placeholder.svg'}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{title}</p>
                      {thread.is_admin_thread ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-300">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : null}
                      {isPending ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">Request</span> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">{thread.latest_message?.body || 'No messages yet.'}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-xl font-bold">No messages yet</p>
            <p className="mt-2 text-sm text-zinc-500">Start a DM or send ViewTube Admin a note.</p>
          </div>
        )}
      </section>
    </div>
  );
}
