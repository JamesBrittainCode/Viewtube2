'use client';

import { useState } from 'react';

export function SetSpotlightButton({ videoId }: { videoId: string }) {
  const [loadingMode, setLoadingMode] = useState<'next' | 'now' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setSpotlight(mode: 'next' | 'now') {
    setLoadingMode(mode);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/spotlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          publish_now: mode === 'now',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule spotlight');

      setMessage(
        mode === 'now'
          ? 'Creator Spotlight is now live.'
          : 'Scheduled for next Monday at 1:00 AM PST.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSpotlight('next')}
          disabled={loadingMode !== null}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {loadingMode === 'next' ? 'Scheduling...' : 'Set Next Creator Spotlight'}
        </button>
        <button
          type="button"
          onClick={() => setSpotlight('now')}
          disabled={loadingMode !== null}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {loadingMode === 'now' ? 'Publishing...' : 'Set Spotlight Live Now'}
        </button>
      </div>
      {message && <p className="text-xs text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
