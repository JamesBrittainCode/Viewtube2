'use client';

import { useState } from 'react';
import { VideoGrid } from '@/components/video-grid';
import { Spinner } from '@/components/spinner';
import { AdsenseSlot } from '@/components/adsense-slot';
import { ShortsShelf } from '@/components/shorts-shelf';
import { PlayablesShelf } from '@/components/playables/playables-shelf';
import { SponsoredHomeBanner } from '@/components/ads/sponsored-home-banner';

type FeedPayload = {
  videos: Array<Record<string, unknown>>;
  hasMore: boolean;
  error?: string;
};

export function HomeFeed({
  initialVideos,
  initialHasMore,
  initialShorts,
  homeBannerAd,
  signedIn,
}: {
  initialVideos: Array<Record<string, unknown>>;
  initialHasMore: boolean;
  initialShorts: Array<Record<string, unknown>>;
  homeBannerAd: { id: string; title: string; image_url: string; click_url: string } | null;
  signedIn: boolean;
}) {
  const homeAdSlot = process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT || null;
  const [videos, setVideos] = useState(initialVideos);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {homeBannerAd ? (
        <div className="mb-4">
          <div className="mx-auto max-w-[1200px]">
            <SponsoredHomeBanner ad={homeBannerAd} />
          </div>
        </div>
      ) : homeAdSlot ? (
        <div className="mb-4">
          <div className="mx-auto max-w-[1200px]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <AdsenseSlot slot={homeAdSlot} className="min-h-[90px] w-full" />
            </div>
          </div>
        </div>
      ) : null}

      <VideoGrid videos={(videos.slice(0, 8) as never[])} signedIn={signedIn} />
      <ShortsShelf shorts={initialShorts as never[]} />
      {signedIn ? <PlayablesShelf /> : null}
      {videos.length > 8 ? <VideoGrid videos={(videos.slice(8) as never[])} signedIn={signedIn} /> : null}

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
