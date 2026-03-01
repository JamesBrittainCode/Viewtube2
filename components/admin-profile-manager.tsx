'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminProfileManager() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          subscribers_count: subscribersCount,
          verified,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setMessage('Profile updated.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Admin profile controls</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Update subscriber count and verification status by username.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Target username"
          required
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
        />

        <input
          type="number"
          min={0}
          value={subscribersCount}
          onChange={(event) => setSubscribersCount(Number(event.target.value) || 0)}
          placeholder="Subscriber count"
          required
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
          />
          Verified channel
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {loading ? 'Updating...' : 'Apply changes'}
        </button>
      </form>
    </section>
  );
}
