'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function StreakEligibilityGate() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!checked || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/streaks/confirm-eligibility', { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to confirm eligibility.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message || 'Failed to confirm eligibility.');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Watch ViewTube, Win Big</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        To enter the contest, you must be at least <span className="font-semibold">16 years old</span> and have a
        ViewTube account.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500 dark:border-zinc-700"
          />
          <span>
            I confirm that I am <span className="font-semibold">16+</span>.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!checked || loading}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {loading ? 'Confirming…' : 'Confirm & continue'}
          </button>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Read{' '}
            <Link href="/streaks/rules" className="font-semibold text-zinc-900 underline dark:text-white">
              rules
            </Link>{' '}
            and{' '}
            <Link href="/streaks/terms" className="font-semibold text-zinc-900 underline dark:text-white">
              terms & conditions
            </Link>
            .
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </div>
  );
}

