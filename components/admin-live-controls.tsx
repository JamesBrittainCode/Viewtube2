'use client';

import { useState } from 'react';

export function AdminLiveControls({ streamId }: { streamId: string }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(action: 'pause' | 'resume' | 'end') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/live-streams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id: streamId, action, reason: reason.trim() }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          msg = (JSON.parse(text) as { error?: string }).error || text;
        } catch {}
        throw new Error(msg || 'Request failed');
      }
      setNotice(action === 'end' ? 'Stream ended.' : action === 'pause' ? 'Stream paused.' : 'Stream resumed.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-300/40 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
      <p className="text-sm font-semibold text-red-800 dark:text-red-200">Admin Live Controls</p>
      <p className="mt-1 text-xs text-red-700/80 dark:text-red-200/80">
        Pause/resume/end this stream for everyone.
      </p>

      <div className="mt-3 space-y-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional reason (shown to creator)"
          className="h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm dark:border-red-900/60 dark:bg-zinc-950"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('pause')}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            Pause
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('resume')}
            className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-zinc-950 dark:text-red-200 dark:hover:bg-red-950/60"
          >
            Resume
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('end')}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            End Stream
          </button>
        </div>

        {error ? <p className="text-sm text-red-700 dark:text-red-200">{error}</p> : null}
        {notice ? <p className="text-sm text-green-700 dark:text-green-300">{notice}</p> : null}
      </div>
    </div>
  );
}

