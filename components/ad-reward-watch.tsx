'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdsenseSlot } from '@/components/adsense-slot';
import { emitStreakEvent } from '@/lib/streak-events';

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function AdRewardWatch({
  seconds = 60,
  slot,
}: {
  seconds?: number;
  slot: string | null;
}) {
  const totalMs = Math.max(10_000, Math.round(seconds * 1000));
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = useMemo(() => Math.max(0, Math.ceil((1 - progress) * seconds)), [progress, seconds]);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    function tick(now: number) {
      const t = clamp01((now - start) / totalMs);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalMs]);

  async function claim() {
    if (!done || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch('/api/streaks/ad-reward', { method: 'POST' });
      const data = (await res.json()) as { claimed?: boolean; streak?: unknown; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to claim reward.');
      setClaimed(Boolean(data.claimed));
      emitStreakEvent(data.streak);
    } catch (e) {
      setError((e as Error).message || 'Failed to claim reward.');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">Watch an ad to earn points</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Stay on this screen until the timer finishes to unlock a +30 point reward.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/streaks" className="text-xs font-semibold text-zinc-700 underline dark:text-zinc-300">
              Back to streaks
            </Link>
            <button
              type="button"
              onClick={() => void claim()}
              disabled={!done || claiming || claimed === true}
              className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {claimed === true ? 'Reward claimed' : claiming ? 'Claiming…' : done ? 'Claim +30 points' : `Wait ${remaining}s`}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full origin-left rounded-full bg-rose-500" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{remaining}s remaining</div>
          {claimed === false ? (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Already claimed today. Come back tomorrow for another +30.
            </div>
          ) : null}
          {error ? (
            <div className="mt-2 text-xs text-red-500">
              {error}
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                If this keeps happening, make sure the `viewtube_activity_awards` table allows inserts for signed-in users.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {slot ? (
              <AdsenseSlot slot={slot} className="min-h-[250px] w-full" />
            ) : (
              <div className="min-h-[250px]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
