'use client';

import { FormEvent, useState } from 'react';
import { displayHandle } from '@/lib/handle';

type AwardResponse = {
  profile?: {
    username?: string | null;
    handle?: string | null;
  };
  award?: {
    points_total?: number;
    points_delta?: number;
  };
  error?: string;
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => null)) as AwardResponse | null;
  return payload?.error || 'Could not award points.';
}

export function AdminPointsAwarder() {
  const [target, setTarget] = useState('');
  const [points, setPoints] = useState(25);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, points, note }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = (await response.json()) as AwardResponse;
      const name = payload.profile?.username || displayHandle(payload.profile?.handle, 'User');
      setMessage(`${name} received +${payload.award?.points_delta || points} points. Total: ${payload.award?.points_total ?? '—'}.`);
      setNote('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">Manual points</h2>
          <p className="mt-1 text-sm text-zinc-500">Quietly award contest points to a user by handle or email.</p>
        </div>
        <div className="rounded-full bg-red-600/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-500">
          Admin only
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3 md:grid-cols-[1.3fr_0.6fr_1.4fr_auto]">
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="@handle or email"
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-red-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          value={points}
          onChange={(event) => setPoints(Number(event.target.value))}
          type="number"
          min={1}
          max={100000}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-red-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Private note (optional)"
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-red-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Awarding…' : 'Award'}
        </button>
      </form>

      {message ? <div className="mt-3 rounded-2xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-500">{message}</div> : null}
      {error ? <div className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm font-semibold text-red-500">{error}</div> : null}
    </section>
  );
}
