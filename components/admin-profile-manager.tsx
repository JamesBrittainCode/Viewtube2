'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeHandle } from '@/lib/handle';

export function AdminProfileManager() {
  const router = useRouter();
  const [countHandle, setCountHandle] = useState('@');
  const [verifyHandle, setVerifyHandle] = useState('@');
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [countMessage, setCountMessage] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  async function onCountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCountLoading(true);
    setCountError(null);
    setCountMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: normalizeHandle(countHandle),
          subscribers_count: subscribersCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setCountMessage('Subscriber count updated.');
      router.refresh();
    } catch (err) {
      setCountError((err as Error).message);
    } finally {
      setCountLoading(false);
    }
  }

  async function onVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: normalizeHandle(verifyHandle),
          verified,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setVerifyMessage('Verification status updated.');
      router.refresh();
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Admin profile controls</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Use an exact handle (`@...`) to target a single user.
      </p>

      <form onSubmit={onCountSubmit} className="mt-5 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="text-sm font-semibold">Subscriber Count</h3>
        <input
          value={countHandle}
          onChange={(event) => setCountHandle(event.target.value)}
          placeholder="@target_handle"
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

        {countError && <p className="text-sm text-red-500">{countError}</p>}
        {countMessage && <p className="text-sm text-green-600 dark:text-green-400">{countMessage}</p>}

        <button
          type="submit"
          disabled={countLoading}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {countLoading ? 'Updating...' : 'Save subscriber count'}
        </button>
      </form>

      <form onSubmit={onVerifySubmit} className="mt-4 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="text-sm font-semibold">Channel Verification</h3>
        <input
          value={verifyHandle}
          onChange={(event) => setVerifyHandle(event.target.value)}
          placeholder="@target_handle"
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

        {verifyError && <p className="text-sm text-red-500">{verifyError}</p>}
        {verifyMessage && <p className="text-sm text-green-600 dark:text-green-400">{verifyMessage}</p>}

        <button
          type="submit"
          disabled={verifyLoading}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          {verifyLoading ? 'Updating...' : 'Save verification status'}
        </button>
      </form>
    </section>
  );
}
