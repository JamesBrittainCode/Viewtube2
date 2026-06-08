'use client';

import { useEffect, useMemo, useState } from 'react';

const contestEndMs = Date.parse('2026-06-08T19:59:59.000Z');

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
  const [remaining, setRemaining] = useState(() => contestEndMs - Date.now());
  const parts = useMemo(() => formatTime(remaining), [remaining]);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(contestEndMs - Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-br from-red-600 via-pink-600 to-orange-500 p-5 text-white shadow-lg dark:border-red-900/60">
      <div className="text-xs font-black uppercase tracking-[0.28em] text-white/75">Contest countdown</div>
      <div className="mt-2 text-lg font-black">Ends Monday, June 8, 2026 at 11:59 AM PST</div>
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
