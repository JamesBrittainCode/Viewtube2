'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';

type Detail = {
  current_streak?: number;
  longest_streak?: number;
  points_total?: number;
  points_delta?: number;
};

function getMilestoneLabel(days: number) {
  if (days >= 365) return 'Legend';
  if (days >= 100) return 'Unstoppable';
  if (days >= 30) return 'On Fire';
  if (days >= 7) return 'Hot Streak';
  if (days >= 3) return 'Warming Up';
  return 'Streak Started';
}

export function StreakCelebration() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(0);
  const [best, setBest] = useState<number>(0);
  const [pointsDelta, setPointsDelta] = useState<number>(0);
  const [pointsTotal, setPointsTotal] = useState<number>(0);

  const label = useMemo(() => getMilestoneLabel(days), [days]);

  useEffect(() => {
    function onEvent(event: Event) {
      const detail = (event as CustomEvent<Detail>).detail || {};
      const nextDays = Number(detail.current_streak || 0);
      const nextBest = Number(detail.longest_streak || 0);
      if (!Number.isFinite(nextDays) || nextDays <= 0) return;

      setDays(nextDays);
      setBest(nextBest);
      setPointsDelta(Number(detail.points_delta || 0));
      setPointsTotal(Number(detail.points_total || 0));
      setOpen(true);
    }

    window.addEventListener('viewtube-streak', onEvent);
    return () => {
      window.removeEventListener('viewtube-streak', onEvent);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-600 text-white">
                <Flame className="h-8 w-8" />
              </div>
              <div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{label}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Keep it going tomorrow to continue your streak.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Streak</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {days}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                day{days === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Best</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {best || days}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">days</div>
            </div>
            <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Points</div>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                +{Math.max(0, pointsDelta)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                total {Math.max(0, pointsTotal)}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
            Interactions earn points. Uploading videos and going live earn the most.
          </div>
        </div>
      </div>
    </div>
  );
}
