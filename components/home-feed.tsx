'use client';

import { useState } from 'react';
import { VideoGrid } from '@/components/video-grid';
import { Spinner } from '@/components/spinner';

type FeedPayload = {
  videos: Array<Record<string, unknown>>;
  hasMore: boolean;
  error?: string;
};

export function HomeFeed({
  initialVideos,
  initialHasMore,
}: {
  initialVideos: Array<Record<string, unknown>>;
  initialHasMore: boolean;
}) {
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

