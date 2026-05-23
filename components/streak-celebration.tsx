'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';

type Detail = {
  current_streak?: number;
  longest_streak?: number;
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

  const label = useMemo(() => getMilestoneLabel(days), [days]);

  useEffect(() => {
    let timeout: number | null = null;

    function onEvent(event: Event) {
      const detail = (event as CustomEvent<Detail>).detail || {};
      const nextDays = Number(detail.current_streak || 0);
      const nextBest = Number(detail.longest_streak || 0);
      if (!Number.isFinite(nextDays) || nextDays <= 0) return;

      setDays(nextDays);
      setBest(nextBest);
      setOpen(true);

      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setOpen(false), 2600);
    }

    window.addEventListener('viewtube-streak', onEvent);
    return () => {
      window.removeEventListener('viewtube-streak', onEvent);
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-start justify-center p-4 pt-16">
      <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl dark:border-red-900/60 dark:bg-zinc-950">
        <div className="relative p-4">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-red-500/15 blur-2xl" />
          <div className="absolute -left-8 -bottom-10 h-28 w-28 rounded-full bg-orange-500/10 blur-2xl" />

          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-600 text-white shadow-[0_10px_30px_rgba(239,68,68,0.35)]">
              <Flame className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">{label}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                ViewTube streak updated
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-900">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Current</div>
              <div className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {days}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-100 px-3 py-2 dark:bg-zinc-900">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Best</div>
              <div className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {best || days}
              </div>
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full w-full origin-left animate-[vtStreakBar_2.6s_ease-out_forwards] rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes vtStreakBar {
          0% {
            transform: scaleX(0);
          }
          12% {
            transform: scaleX(1);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  );
}

