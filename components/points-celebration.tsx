'use client';

import { useEffect, useRef, useState } from 'react';

type Detail = {
  points_delta?: number;
  points_total?: number;
};

function animateNumber(
  from: number,
  to: number,
  ms: number,
  onUpdate: (value: number) => void,
  onDone: () => void,
) {
  const start = performance.now();
  const delta = to - from;
  function tick(now: number) {
    const t = Math.min(1, (now - start) / ms);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - t, 3);
    onUpdate(Math.round(from + delta * eased));
    if (t < 1) requestAnimationFrame(tick);
    else onDone();
  }
  requestAnimationFrame(tick);
}

export function PointsCelebration() {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(0);
  const [displayTotal, setDisplayTotal] = useState(0);
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function onEvent(event: Event) {
      const detail = (event as CustomEvent<Detail>).detail || {};
      const pointsDelta = Math.max(0, Number(detail.points_delta || 0));
      const pointsTotal = Math.max(0, Number(detail.points_total || 0));
      if (!Number.isFinite(pointsDelta) || pointsDelta <= 0) return;

      setDelta(pointsDelta);
      setOpen(true);

      const fromTotal = Math.max(0, pointsTotal - pointsDelta);
      setDisplayTotal(fromTotal);
      animateNumber(fromTotal, pointsTotal, 700, setDisplayTotal, () => {});

      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = window.setTimeout(() => setOpen(false), 1800);
    }

    window.addEventListener('viewtube-points', onEvent);
    return () => {
      window.removeEventListener('viewtube-points', onEvent);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[85] flex justify-center px-4">
      <div className="pointer-events-none w-full max-w-sm rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <span className="text-base leading-none" aria-hidden="true">
              ✨
            </span>
            <span>+{delta} points</span>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            total <span className="font-semibold text-zinc-900 dark:text-white">{displayTotal}</span>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full w-full origin-left animate-[vtPointsBar_1.8s_ease-out_forwards] rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-600" />
        </div>
      </div>
      <style jsx>{`
        @keyframes vtPointsBar {
          0% {
            transform: scaleX(0);
            opacity: 1;
          }
          20% {
            transform: scaleX(1);
            opacity: 1;
          }
          100% {
            transform: scaleX(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

