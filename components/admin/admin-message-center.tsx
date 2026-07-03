'use client';

import { useState, type FormEvent } from 'react';
import { Send, ShieldCheck } from 'lucide-react';

export function AdminMessageCenter() {
  const [mode, setMode] = useState<'user' | 'all'>('user');
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('Message from ViewTube Admin');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    const res = await fetch('/api/admin/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, target, title, message }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      recipients?: number;
      emailsSent?: number;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error || 'Could not send admin message.');
      return;
    }
    setMessage('');
    setTarget('');
    setStatus(`Sent to ${data.recipients || 0} user${data.recipients === 1 ? '' : 's'}. ${data.emailsSent || 0} inactive user email${data.emailsSent === 1 ? '' : 's'} sent.`);
  }

  return (
    <section className="rounded-3xl border border-sky-500/25 bg-sky-500/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-300" />
            <h2 className="text-2xl font-black">Admin messages</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Send inbox notifications to one ViewTuber or everyone. Users inactive for 7+ days get a private email prompt.
          </p>
        </div>
      </div>

      <form onSubmit={send} className="mt-5 grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('user')}
            className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'user' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}
          >
            Specific user
          </button>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'all' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-300'}`}
          >
            All users
          </button>
        </div>
        {mode === 'user' ? (
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="@handle or email"
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-sky-400"
          />
        ) : (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            This will create an admin message thread for every ViewTube account.
          </p>
        )}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Thread title"
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-sky-400"
        />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write the admin message..."
          rows={5}
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-sky-400"
        />
        <button
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-5 py-3 font-black text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {loading ? 'Sending...' : 'Send admin message'}
        </button>
        {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
      </form>
    </section>
  );
}
