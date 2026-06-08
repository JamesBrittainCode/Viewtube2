'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  VIEWTUBE_CONTEST_END_LABEL,
  VIEWTUBE_CONTEST_END_MS,
  VIEWTUBE_CONTEST_SHORT_LABEL,
} from '@/lib/contest';

function formatTime(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function StreakCountdown() {
  const [remaining, setRemaining] = useState(() => VIEWTUBE_CONTEST_END_MS - Date.now());
  const parts = useMemo(() => formatTime(remaining), [remaining]);
  const ended = remaining <= 0;

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(VIEWTUBE_CONTEST_END_MS - Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (ended) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-yellow-300/60 bg-gradient-to-br from-red-600 via-fuchsia-600 to-yellow-500 p-6 text-white shadow-2xl dark:border-yellow-400/40">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-6 right-10 h-32 w-32 rounded-full bg-yellow-200 blur-3xl" />
        </div>
        <div className="relative">
          <div className="text-5xl">🎉</div>
          <div className="mt-3 text-xs font-black uppercase tracking-[0.32em] text-white/75">Contest ended</div>
          <h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">ViewTube Win Big is complete!</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold text-white/85 md:text-base">
            The leaderboard is locked and the winner is being verified. Keep an eye on ViewTube Studio and announcements
            for the mystery prize bundle reveal.
          </p>
          <div className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-950 shadow-lg">
            Ended {VIEWTUBE_CONTEST_SHORT_LABEL}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-600 via-pink-600 to-orange-500 p-5 text-white shadow-lg dark:border-red-900/60">
      <div className="text-xs font-black uppercase tracking-[0.28em] text-white/75">Contest countdown</div>
      <div className="mt-2 text-lg font-black">Ends {VIEWTUBE_CONTEST_END_LABEL}</div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ['Days', parts.days],
          ['Hours', parts.hours],
          ['Min', parts.minutes],
          ['Sec', parts.seconds],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
            <div className="text-2xl font-black tabular-nums">{String(value).padStart(2, '0')}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
