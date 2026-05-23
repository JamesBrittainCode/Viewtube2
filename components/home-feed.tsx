'use client';

import { useEffect, useState } from 'react';
import { VideoGrid } from '@/components/video-grid';
import { Spinner } from '@/components/spinner';
import { AdsenseSlot } from '@/components/adsense-slot';
import { HomeContestBanner } from '@/components/home-contest-banner';

type FeedPayload = {
  videos: Array<Record<string, unknown>>;
  hasMore: boolean;
  error?: string;
};

const CONTEST_BANNER_STORAGE_KEY = 'vtContestHomeBannerDismissed';

export function HomeFeed({
  initialVideos,
  initialHasMore,
}: {
  initialVideos: Array<Record<string, unknown>>;
  initialHasMore: boolean;
}) {
  const homeAdSlot = process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT;
  const [showContestBanner, setShowContestBanner] = useState<boolean | null>(null);
  const [videos, setVideos] = useState(initialVideos);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(CONTEST_BANNER_STORAGE_KEY) === '1';
    setShowContestBanner(!dismissed);
  }, []);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feed/home?page=${page + 1}`, { cache: 'no-store' });
      const data = (await res.json()) as FeedPayload;
      if (!res.ok) throw new Error(data.error || 'Failed to load more videos.');

      setVideos((prev) => {
        const seen = new Set(prev.map((v) => String(v.id)));
        const merged = [...prev];
        for (const item of data.videos || []) {
          const id = String(item.id);
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(item);
          }
        }
        return merged;
      });
      setPage((p) => p + 1);
      setHasMore(Boolean(data.hasMore));
    } catch (e) {
      setError((e as Error).message || 'Failed to load more videos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      {showContestBanner === null ? null : showContestBanner ? (
        <div className="mb-4">
          <div className="mx-auto max-w-[1200px]">
            <HomeContestBanner
              href="/streaks"
              seconds={7}
              onClosed={() => setShowContestBanner(false)}
            />
          </div>
        </div>
      ) : homeAdSlot ? (
        <div className="mb-4">
          <div className="mx-auto max-w-[1200px]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <AdsenseSlot slot={homeAdSlot} className="min-h-[90px]" />
            </div>
          </div>
        </div>
      ) : null}

      <VideoGrid videos={videos as never[]} />

      <div className="mt-8 flex flex-col items-center justify-center gap-3">
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {hasMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-white dark:text-zinc-900"
          >
            {loading ? (
              <>
                <Spinner size={18} className="border-zinc-400 border-t-white dark:border-zinc-400 dark:border-t-zinc-900" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        ) : (
          <p className="text-sm text-zinc-500">You’re all caught up.</p>
        )}
      </div>
    </section>
  );
}
