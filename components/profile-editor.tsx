'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  username: string;
  handle: string;
  bio: string;
};

export function ProfileEditor({
  username: initialUsername,
  handle: initialHandle,
  bio: initialBio,
}: Props) {
  const [username, setUsername] = useState(initialUsername);
  const [handle, setHandle] = useState(initialHandle);
  const [bio, setBio] = useState(initialBio);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, handle, bio }),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        minLength={3}
        required
        className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="Username"
      />
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="Bio"
      />
      <input
        value={handle}
        onChange={(event) => setHandle(event.target.value)}
        minLength={4}
        required
        className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="@your_handle"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
      >
        {loading ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  );
}
