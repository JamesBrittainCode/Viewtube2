'use client';

import { useState } from 'react';

export function SetSpotlightButton({ videoId }: { videoId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setSpotlight() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/spotlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule spotlight');

      setMessage('Scheduled for next Monday at 1:00 AM PST.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={setSpotlight}
        disabled={loading}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {loading ? 'Scheduling...' : 'Set Next Creator Spotlight'}
      </button>
      {message && <p className="text-xs text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
