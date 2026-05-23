'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function StreakCounter({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    function onEvent(event: Event) {
      const detail = (event as CustomEvent<{ current_streak?: number }>).detail || {};
      const next = Number(detail.current_streak || 0);
      if (Number.isFinite(next) && next > 0) setValue(next);
    }
    window.addEventListener('viewtube-streak', onEvent);
    return () => window.removeEventListener('viewtube-streak', onEvent);
  }, []);

  return (
    <Link
      href="/streaks"
      className="hidden items-center gap-2 rounded-full border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-100 sm:inline-flex dark:border-zinc-700 dark:hover:bg-zinc-800"
      title="ViewTube Streak"
    >
      <span aria-hidden="true">🔥</span>
      <span>{value}</span>
    </Link>
  );
}

