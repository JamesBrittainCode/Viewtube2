'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
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

type Message = {
  id: string;
  sender_id: string | null;
  body: string;
  is_admin_message: boolean;
  created_at: string;
};

type Payload = {
  thread: {
    id: string;
    title: string | null;
    is_admin_thread: boolean;
  };
  myParticipant: {
    status: string;
  };
  participants: Participant[];
  messages: Message[];
  currentUserId: string;
};

export function MessageThread({ threadId }: { threadId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadThread() {
    const res = await fetch(`/api/messages/${threadId}`, { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as Payload & { error?: string };
    if (res.ok) setPayload(data);
    else setStatus(data.error || 'Could not load message thread.');
  }

  useEffect(() => {
    void loadThread();
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [payload?.messages.length]);

  const profileById = useMemo(() => {
    const map = new Map<string, Profile | null>();
    for (const participant of payload?.participants || []) map.set(participant.user_id, participant.profile);
    return map;
  }, [payload?.participants]);

  const other = payload?.participants.find((item) => item.user_id !== payload.currentUserId) || null;
  const title = payload?.thread.title || other?.profile?.username || displayHandle(other?.profile?.handle);
  const pending = payload?.myParticipant.status === 'pending';

  async function acceptRequest() {
    setStatus(null);
    const res = await fetch(`/api/messages/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || 'Could not accept request.');
      return;
    }
    await loadThread();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const res = await fetch(`/api/messages/${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || 'Could not send message.');
      return;
    }
    setMessage('');
    await loadThread();
  }

  if (!payload) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-center text-zinc-500">
        {status || 'Loading conversation...'}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/messages" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Image
          src={other?.profile?.avatar_url || '/avatar-placeholder.svg'}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-black">{title}</h1>
            {payload.thread.is_admin_thread ? <ShieldCheck className="h-5 w-5 text-sky-400" /> : null}
          </div>
          <p className="text-sm text-zinc-500">{displayHandle(other?.profile?.handle)}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
        {pending ? (
          <div className="mb-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
            <p className="font-bold text-sky-200">Message request</p>
            <p className="mt-1 text-sm text-zinc-400">Accept this request before replying.</p>
            <button
              onClick={acceptRequest}
              className="mt-3 rounded-full bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-400"
            >
              Accept request
            </button>
          </div>
        ) : null}
        <div className="space-y-3">
          {payload.messages.map((item) => {
            const mine = item.sender_id === payload.currentUserId;
            const sender = item.sender_id ? profileById.get(item.sender_id) : null;
            return (
              <div key={item.id} className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine ? (
                  <Image
                    src={sender?.avatar_url || '/avatar-placeholder.svg'}
                    alt=""
                    width={32}
                    height={32}
                    className="mt-1 h-8 w-8 rounded-full object-cover"
                  />
                ) : null}
                <div
                  className={`max-w-[75%] rounded-3xl px-4 py-3 text-sm ${
                    mine
                      ? 'bg-red-600 text-white'
                      : item.is_admin_message
                        ? 'bg-sky-500/15 text-zinc-100 ring-1 ring-sky-400/30'
                        : 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {!mine ? (
                    <div className="mb-1 flex items-center gap-1 text-xs font-bold opacity-75">
                      {sender?.username || displayHandle(sender?.handle)}
                      {item.is_admin_message ? <ShieldCheck className="h-3.5 w-3.5 text-sky-300" /> : null}
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap">{item.body}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={send} className="mt-4 flex gap-3">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={pending ? 'Accept this message request to reply' : 'Message...'}
          disabled={pending}
          className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 outline-none focus:border-red-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          disabled={pending || !message.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
      {status ? <p className="mt-2 text-sm text-red-400">{status}</p> : null}
    </div>
  );
}
