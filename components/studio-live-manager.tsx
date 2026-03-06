'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type LiveStream = {
  id: string;
  title: string;
  description: string;
  is_live: boolean;
  started_at: string;
};

export function StudioLiveManager({
  activeStream,
}: {
  activeStream: LiveStream | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(activeStream?.title || 'Live Stream');
  const [description, setDescription] = useState(activeStream?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/live/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      const data = (await res.json()) as { stream?: LiveStream; error?: string };
      if (!res.ok || !data.stream) throw new Error(data.error || 'Could not start stream.');
      router.push(`/live/${data.stream.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function endStream() {
    if (!activeStream) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/streams/${activeStream.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', title, description }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not end stream.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
      <h2 className="text-xl font-semibold">Live Control Room</h2>
      <p className="text-sm text-zinc-400">
        Start a live stream from your browser camera and microphone. No third-party software required.
      </p>

      <form onSubmit={startStream} className="space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Stream title"
          required
          maxLength={120}
          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Stream description"
          rows={3}
          maxLength={1000}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
        />

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {activeStream?.is_live ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/live/${activeStream.id}`)}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              Open Live Stream
            </button>
            <button
              type="button"
              onClick={() => void endStream()}
              disabled={loading}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {loading ? 'Ending…' : 'End Live Stream'}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Go Live'}
          </button>
        )}
      </form>
    </div>
  );
}
