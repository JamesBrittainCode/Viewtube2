'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { unwrapRelation } from '@/lib/profile';

type ShortRow = {
  id: string;
  title: string;
  video_url: string;
  profiles?: { username?: string; handle?: string | null } | Array<{ username?: string; handle?: string | null }>;
};

function useActiveIndex() {
  const [activeIndex, setActiveIndex] = useState(0);
  return { activeIndex, setActiveIndex };
}

export function ShortsFeed({ initialShorts }: { initialShorts: ShortRow[] }) {
  const shorts = useMemo(() => initialShorts || [], [initialShorts]);
  const { activeIndex, setActiveIndex } = useActiveIndex();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-short-item="1"]'));
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
        if (!visible) return;
        const idx = Number((visible.target as HTMLElement).dataset.index || 0);
        if (Number.isFinite(idx)) setActiveIndex(idx);
      },
      { threshold: [0.6, 0.75, 0.9] },
    );

    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, [setActiveIndex, shorts.length]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-short-video="1"]'));
    videos.forEach((video, idx) => {
      if (idx === activeIndex) {
        void video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex]);

  if (!shorts.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        No shorts yet.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <div
        ref={containerRef}
        className="h-[calc(100vh-7rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-3xl border border-zinc-200 bg-black shadow-sm dark:border-zinc-800"
      >
        {shorts.map((item, idx) => {
          const profile = unwrapRelation(item.profiles);
          const handle = profile?.handle || null;
          const channelHref = handle ? `/channel/${handle}` : '/';
          return (
            <div
              key={item.id}
              data-short-item="1"
              data-index={idx}
              className="relative h-[calc(100vh-7rem)] snap-start"
            >
              <video
                data-short-video="1"
                src={item.video_url}
                className="h-full w-full object-contain"
                playsInline
                muted={false}
                controls={false}
                preload="metadata"
                loop
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
                <div className="pointer-events-auto flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={channelHref}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline"
                    >
                      {profile?.username || (handle ? `@${handle}` : 'Channel')}
                    </Link>
                    <div className="mt-1 line-clamp-2 text-sm text-white/90">{item.title}</div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-white/80">
                      <Link href={`/watch/${item.id}`} className="underline">
                        Open watch page
                      </Link>
                      <Link href="/streaks" className="underline">
                        Streaks
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-3 pb-1 text-white">
                    <button
                      type="button"
                      className="pointer-events-auto rounded-full bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
                      onClick={() => {
                        const el = containerRef.current?.querySelector<HTMLElement>(`[data-index=\"${idx + 1}\"]`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
        Tip: scroll to switch shorts.
      </p>
    </div>
  );
}

