'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Edit3, MessageCircle, Search, Send, ShieldCheck } from 'lucide-react';
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

type ThreadSummary = {
  id: string;
  title: string | null;
  is_admin_thread: boolean;
  is_broadcast: boolean;
  updated_at: string;
  my_participant?: { status?: string } | null;
  participants: Participant[];
  latest_message: { body: string; created_at: string; is_admin_message?: boolean } | null;
};

type ThreadMessage = {
  id: string;
  sender_id: string | null;
  body: string;
  is_admin_message: boolean;
  created_at: string;
};

type ThreadPayload = {
  thread: {
    id: string;
    title: string | null;
    is_admin_thread: boolean;
  };
  myParticipant: {
    status: string;
  };
  participants: Participant[];
  messages: ThreadMessage[];
  currentUserId: string;
};

function otherParticipant(thread: Pick<ThreadSummary, 'participants'>, currentUserId: string) {
  return thread.participants.find((item) => item.user_id !== currentUserId) || thread.participants[0] || null;
}

function threadTitle(thread: Pick<ThreadSummary, 'title' | 'participants'>, currentUserId: string) {
  const other = otherParticipant(thread, currentUserId);
  return thread.title || other?.profile?.username || displayHandle(other?.profile?.handle) || 'Conversation';
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function MessagesInbox({
  currentUserId,
  selectedThreadId,
}: {
  currentUserId: string;
  selectedThreadId?: string;
}) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState(selectedThreadId || '');
  const [activeThread, setActiveThread] = useState<ThreadPayload | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [query, setQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendToAdmin, setSendToAdmin] = useState(false);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadThreads(preferredThreadId?: string) {
    setLoadingThreads(true);
    const res = await fetch('/api/messages', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as { threads?: ThreadSummary[]; error?: string };
    if (res.ok) {
      const sorted = [...(data.threads || [])].sort((a, b) => {
        if (a.is_admin_thread !== b.is_admin_thread) return a.is_admin_thread ? -1 : 1;
        if ((a.my_participant?.status === 'pending') !== (b.my_participant?.status === 'pending')) {
          return a.my_participant?.status === 'pending' ? -1 : 1;
        }
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      setThreads(sorted);
      const nextActive = preferredThreadId || activeThreadId || sorted[0]?.id || '';
      setActiveThreadId(nextActive);
    } else {
      setStatus(data.error || 'Could not load messages.');
    }
    setLoadingThreads(false);
  }

  async function loadThread(threadId: string) {
    if (!threadId) {
      setActiveThread(null);
      return;
    }
    setLoadingThread(true);
    const res = await fetch(`/api/messages/${threadId}`, { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as ThreadPayload & { error?: string };
    if (res.ok) setActiveThread(data);
    else setStatus(data.error || 'Could not load conversation.');
    setLoadingThread(false);
  }

  useEffect(() => {
    void loadThreads(selectedThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  useEffect(() => {
    if (activeThreadId) void loadThread(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length]);

  const filteredThreads = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return threads;
    return threads.filter((thread) => {
      const other = otherParticipant(thread, currentUserId);
      return [
        thread.title,
        other?.profile?.username,
        other?.profile?.handle,
        thread.latest_message?.body,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(clean));
    });
  }, [currentUserId, query, threads]);

  const adminThreads = filteredThreads.filter((thread) => thread.is_admin_thread);
  const normalThreads = filteredThreads.filter((thread) => !thread.is_admin_thread);
  const activeOther = activeThread?.participants.find((item) => item.user_id !== currentUserId) || null;
  const activeTitle = activeThread
    ? activeThread.thread.title || activeOther?.profile?.username || displayHandle(activeOther?.profile?.handle)
    : 'Messages';
  const activePending = activeThread?.myParticipant.status === 'pending';
  const profileById = useMemo(() => {
    const map = new Map<string, Profile | null>();
    for (const participant of activeThread?.participants || []) map.set(participant.user_id, participant.profile);
    return map;
  }, [activeThread?.participants]);

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, toAdmin: sendToAdmin, message: newMessage }),
    });
    const data = (await res.json().catch(() => ({}))) as { threadId?: string; error?: string };
    if (!res.ok || !data.threadId) {
      setStatus(data.error || 'Could not send message.');
      return;
    }
    setTarget('');
    setNewMessage('');
    setSendToAdmin(false);
    setComposeOpen(false);
    setActiveThreadId(data.threadId);
    window.history.replaceState(null, '', `/messages/${data.threadId}`);
    await loadThreads(data.threadId);
  }

  async function acceptRequest() {
    if (!activeThreadId) return;
    setStatus(null);
    const res = await fetch(`/api/messages/${activeThreadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || 'Could not accept request.');
      return;
    }
    await Promise.all([loadThread(activeThreadId), loadThreads(activeThreadId)]);
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeThreadId || !reply.trim()) return;
    setStatus(null);
    const res = await fetch(`/api/messages/${activeThreadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || 'Could not send message.');
      return;
    }
    setReply('');
    await Promise.all([loadThread(activeThreadId), loadThreads(activeThreadId)]);
  }

  function renderThreadList(items: ThreadSummary[], label: string) {
    if (!items.length) return null;
    return (
      <div className="space-y-1">
        <p className="px-3 pt-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        {items.map((thread) => {
          const other = otherParticipant(thread, currentUserId);
          const profile = other?.profile;
          const isActive = thread.id === activeThreadId;
          const isPending = thread.my_participant?.status === 'pending';
          return (
            <Link
              key={thread.id}
              href={`/messages/${thread.id}`}
              onClick={() => setActiveThreadId(thread.id)}
              className={`grid grid-cols-[44px_1fr_auto] gap-3 rounded-2xl px-3 py-3 transition ${
                isActive ? 'bg-red-600/15 ring-1 ring-red-500/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Image
                src={profile?.avatar_url || '/avatar-placeholder.svg'}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-black">{threadTitle(thread, currentUserId)}</p>
                  {thread.is_admin_thread ? <ShieldCheck className="h-4 w-4 shrink-0 text-sky-400" /> : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {thread.latest_message?.body || (isPending ? 'Message request' : 'No messages yet')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] text-zinc-500">{formatTime(thread.latest_message?.created_at || thread.updated_at)}</span>
                {isPending ? <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> : null}
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto h-[calc(100vh-4rem)] max-w-7xl px-3 py-4">
      <div className="grid h-full overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-[360px_1fr]">
        <aside
          className={`min-h-0 flex-col border-b border-zinc-200 dark:border-zinc-800 lg:flex lg:border-b-0 lg:border-r ${
            selectedThreadId ? 'hidden' : 'flex'
          }`}
        >
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black">Messages</h1>
                <p className="text-xs text-zinc-500">Admin messages stay pinned up top.</p>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen((state) => !state)}
                className="rounded-full bg-red-600 p-3 text-white shadow-lg shadow-red-950/20 hover:bg-red-500"
                aria-label="New message"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          {composeOpen ? (
            <form onSubmit={createThread} className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
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
                  className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              ) : null}
              <textarea
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Write a message..."
                rows={3}
                className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingThreads ? (
              <div className="p-8 text-center text-sm text-zinc-500">Loading messages...</div>
            ) : filteredThreads.length ? (
              <>
                {renderThreadList(adminThreads, 'Admin')}
                {renderThreadList(normalThreads, 'All')}
              </>
            ) : (
              <div className="p-8 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-zinc-500" />
                <p className="mt-3 text-sm font-bold">No messages found</p>
                <p className="mt-1 text-xs text-zinc-500">Start one with the compose button.</p>
              </div>
            )}
          </div>
        </aside>

        <main className={`min-h-0 flex-col ${selectedThreadId ? 'flex' : 'hidden lg:flex'}`}>
          {activeThreadId ? (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div className="flex min-w-0 items-center gap-3">
                  <Image
                    src={activeOther?.profile?.avatar_url || '/avatar-placeholder.svg'}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-black">{activeTitle}</h2>
                      {activeThread?.thread.is_admin_thread ? <ShieldCheck className="h-5 w-5 text-sky-400" /> : null}
                    </div>
                    <p className="truncate text-xs text-zinc-500">{displayHandle(activeOther?.profile?.handle)}</p>
                  </div>
                </div>
                {activeThread?.thread.is_admin_thread ? (
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-300">ViewTube Admin</span>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-6 dark:bg-zinc-950">
                {loadingThread ? <p className="text-center text-sm text-zinc-500">Loading conversation...</p> : null}
                {activePending ? (
                  <div className="mx-auto mb-6 max-w-xl rounded-3xl border border-sky-400/30 bg-sky-500/10 p-4 text-center">
                    <p className="font-black text-sky-200">Message request</p>
                    <p className="mt-1 text-sm text-zinc-400">Accept this request before replying.</p>
                    <button
                      type="button"
                      onClick={acceptRequest}
                      className="mt-3 rounded-full bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400"
                    >
                      Accept request
                    </button>
                  </div>
                ) : null}
                <div className="space-y-4">
                  {activeThread?.messages.map((item) => {
                    const mine = item.sender_id === currentUserId;
                    const sender = item.sender_id ? profileById.get(item.sender_id) : null;
                    return (
                      <div key={item.id} className={`flex gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {!mine ? (
                          <Image
                            src={sender?.avatar_url || '/avatar-placeholder.svg'}
                            alt=""
                            width={34}
                            height={34}
                            className="mt-5 h-8 w-8 rounded-full object-cover"
                          />
                        ) : null}
                        <div className={`max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-zinc-500">
                            <span>{mine ? 'You' : sender?.username || displayHandle(sender?.handle)}</span>
                            <span>{formatTime(item.created_at)}</span>
                          </div>
                          <div
                            className={`rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                              mine
                                ? 'bg-red-600 text-white'
                                : item.is_admin_message
                                  ? 'bg-sky-500/15 text-zinc-100 ring-1 ring-sky-400/30'
                                  : 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{item.body}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </div>

              <form onSubmit={sendReply} className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <input
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={activePending ? 'Accept this message request to reply' : 'Type a message'}
                    disabled={activePending}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
                  />
                  <button
                    disabled={activePending || !reply.trim()}
                    className="rounded-full bg-red-600 p-2 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {status ? <p className="mt-2 text-sm text-red-400">{status}</p> : null}
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <div>
                <MessageCircle className="mx-auto h-12 w-12 text-zinc-500" />
                <p className="mt-4 text-xl font-black">Pick a conversation</p>
                <p className="mt-2 text-sm text-zinc-500">Select a message on the left or start a new one.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
