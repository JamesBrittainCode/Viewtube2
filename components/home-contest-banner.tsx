'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'vtContestHomeBannerDismissed';

function emitAnnouncementShow() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('vt-contest-announcement-show'));
}

export function HomeContestBanner({
  seconds = 7,
  href = '/streaks',
  onClosed,
}: {
  seconds?: number;
  href?: string;
  onClosed?: () => void;
}) {
  const totalMs = Math.max(2000, Math.round(seconds * 1000));
  const [progress, setProgress] = useState(0);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  const segments = useMemo(() => 14, []);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (dismissed === '1') {
      setClosed(true);
      return;
    }

    let raf = 0;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / totalMs);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        setClosing(true);
        emitAnnouncementShow();
        window.setTimeout(() => {
          window.localStorage.setItem(STORAGE_KEY, '1');
          setClosed(true);
          onClosed?.();
        }, 420);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onClosed, totalMs]);

  if (closed) return null;

  return (
    <div
      className={[
        'relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950',
        'transition-[max-height,opacity,transform] duration-400 ease-out',
        closing ? 'max-h-0 -translate-y-2 opacity-0' : 'max-h-[400px] opacity-100',
      ].join(' ')}
    >
      <Link href={href} className="block">
        <Image
          src="/contest-banner.png"
          alt="Watch ViewTube, Win Big"
          width={2048}
          height={422}
          priority
          className="h-auto w-full"
          sizes="(max-width: 1200px) 100vw, 1200px"
        />
      </Link>

      <div className="absolute inset-x-4 bottom-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: segments }).map((_, idx) => {
            const threshold = (idx + 1) / segments;
            const on = progress >= threshold;
            return (
              <div
                key={idx}
                className={[
                  'h-1 flex-1 rounded-full',
                  on ? 'bg-white/90' : 'bg-white/35',
                  'shadow-[0_1px_0_rgba(0,0,0,0.25)]',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
