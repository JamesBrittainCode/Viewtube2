'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  videoId: string;
  initialTitle: string;
  initialDescription: string;
  initialCommentsEnabled: boolean;
};

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Update failed';
  } catch {
    return text || 'Update failed';
  }
}

export function StudioVideoEditForm({
  videoId,
  initialTitle,
  initialDescription,
  initialCommentsEnabled,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [commentsEnabled, setCommentsEnabled] = useState(initialCommentsEnabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          comments_enabled: commentsEnabled,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setMessage('Video updated.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5"
    >
      <div>
        <label className="mb-2 block text-sm text-zinc-400">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-400">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={7}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={commentsEnabled}
          onChange={(event) => setCommentsEnabled(event.target.checked)}
          className="h-4 w-4"
        />
        Allow comments
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-70"
      >
        {loading ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}
