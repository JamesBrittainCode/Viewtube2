'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle,
  MoreVertical,
  Pause,
  Play,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { unwrapRelation } from '@/lib/profile';
import { CommentSection } from '@/components/comment-section';
import { emitStreakEvent } from '@/lib/streak-events';

type ShortRow = {
  id: string;
  user_id: string;
  title: string;
  video_url: string;
  comments_enabled?: boolean | null;
  profiles?:
    | { username?: string; handle?: string | null; avatar_url?: string | null }
    | Array<{ username?: string; handle?: string | null; avatar_url?: string | null }>;
};

type CountsById = Record<
  string,
  { likes: number; dislikes: number; comments: number; likedByMe: boolean; dislikedByMe: boolean }
>;

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text || 'Request failed' };
  }
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

function isUnauthorizedPayload(payload: unknown) {
  const msg =
    payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error || '').toLowerCase()
      : '';
  return msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('sign in');
}

function readNumber(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return 0;
  const value = (payload as Record<string, unknown>)[key];
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function readBoolean(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return false;
  const value = (payload as Record<string, unknown>)[key];
  return Boolean(value);
}

export function ShortsFeed({
  initialShorts,
  currentUserId,
}: {
  initialShorts: ShortRow[];
  currentUserId: string | null;
}) {
  const shorts = useMemo(() => initialShorts || [], [initialShorts]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [counts, setCounts] = useState<CountsById>({});
  const [commentsOpenFor, setCommentsOpenFor] = useState<string | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

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
  }, [shorts.length]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-short-video="1"]'));
    videos.forEach((video, idx) => {
      video.muted = muted;
      if (idx === activeIndex) {
        if (paused) {
          video.pause();
        } else {
          void video.play().catch(() => {});
        }
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex, muted, paused]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
      if (e.key === 'm' || e.key === 'M') {
        setMuted((m) => !m);
      }
      if (e.key === 'Escape') {
        setCommentsOpenFor(null);
        setMenuOpenFor(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    // Seed counts lazily using a read-only reactions endpoint.
    const ids = shorts
      .slice(Math.max(0, activeIndex - 1), Math.min(shorts.length, activeIndex + 3))
      .map((s) => s.id);
    const missing = ids.filter((id) => !counts[id]);
    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      const updates: CountsById = {};
      await Promise.all(
        missing.map(async (id) => {
          const res = await fetch(`/api/videos/${id}/reactions`, { cache: 'no-store' }).catch(() => null);
          const payload = res ? await safeJson(res) : null;
          updates[id] = {
            likes: readNumber(payload, 'likes'),
            dislikes: readNumber(payload, 'dislikes'),
            comments: readNumber(payload, 'comments'),
            likedByMe: readBoolean(payload, 'likedByMe'),
            dislikedByMe: readBoolean(payload, 'dislikedByMe'),
          };
        }),
      );
      if (!cancelled && Object.keys(updates).length) setCounts((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      cancelled = true;
    };
  }, [activeIndex, shorts, counts]);

  async function toggleLike(videoId: string) {
    const res = await fetch(`/api/videos/${videoId}/like`, { method: 'POST' });
    const payload = await safeJson(res);
    if (!res.ok && isUnauthorizedPayload(payload)) {
      window.location.href = `/sign-in?redirect=${encodeURIComponent(`/shorts/${videoId}`)}`;
      return;
    }
    if (!res.ok) return;

    setCounts((prev) => {
      const cur = prev[videoId] || { likes: 0, dislikes: 0, comments: 0, likedByMe: false, dislikedByMe: false };
      const liked = readBoolean(payload, 'liked');
      const count = readNumber(payload, 'count');
      const dislikedByMe = liked ? false : cur.dislikedByMe;
      return {
        ...prev,
        [videoId]: { ...cur, likes: count, likedByMe: liked, dislikedByMe },
      };
    });
    if (payload && typeof payload === 'object' && 'streak' in payload) emitStreakEvent((payload as { streak: unknown }).streak);
  }

  async function toggleDislike(videoId: string) {
    const res = await fetch(`/api/videos/${videoId}/dislike`, { method: 'POST' });
    const payload = await safeJson(res);
    if (!res.ok && isUnauthorizedPayload(payload)) {
      window.location.href = `/sign-in?redirect=${encodeURIComponent(`/shorts/${videoId}`)}`;
      return;
    }
    if (!res.ok) return;

    setCounts((prev) => {
      const cur = prev[videoId] || { likes: 0, dislikes: 0, comments: 0, likedByMe: false, dislikedByMe: false };
      const disliked = readBoolean(payload, 'disliked');
      const count = readNumber(payload, 'count');
      const likedByMe = disliked ? false : cur.likedByMe;
      return {
        ...prev,
        [videoId]: { ...cur, dislikes: count, dislikedByMe: disliked, likedByMe },
      };
    });
  }

  async function share(videoId: string) {
    const url = `${window.location.origin}/shorts/${videoId}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // fallthrough to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  }

  if (!shorts.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        No shorts yet.
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[980px]">
        <div
          ref={containerRef}
          className="h-[calc(100vh-7rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-3xl border border-zinc-200 bg-black shadow-sm dark:border-zinc-800"
        >
          {shorts.map((item, idx) => {
            const profile = unwrapRelation(item.profiles);
            const handle = profile?.handle || null;
            const channelHref = handle ? `/channel/${handle}` : '/';
            const state = counts[item.id] || {
              likes: 0,
              dislikes: 0,
              comments: 0,
              likedByMe: false,
              dislikedByMe: false,
            };

            return (
              <div key={item.id} data-short-item="1" data-index={idx} className="relative h-[calc(100vh-7rem)] snap-start">
                <div className="relative mx-auto flex h-full max-w-[520px] items-center justify-center px-4">
                  <div className="relative h-full w-full max-w-[420px] overflow-hidden rounded-3xl bg-black">
                    <video
                      data-short-video="1"
                      src={item.video_url}
                      className="h-full w-full object-contain"
                      playsInline
                      preload="metadata"
                      loop
                      onClick={() => setPaused((p) => !p)}
                    />

                    {/* Top overlay controls */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
                      <div className="pointer-events-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPaused((p) => !p)}
                          className="rounded-full bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60"
                          aria-label={paused ? 'Play' : 'Pause'}
                          title={paused ? 'Play' : 'Pause'}
                        >
                          {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMuted((m) => !m)}
                          className="rounded-full bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60"
                          aria-label={muted ? 'Unmute' : 'Mute'}
                          title={muted ? 'Unmute' : 'Mute'}
                        >
                          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMenuOpenFor((cur) => (cur === item.id ? null : item.id))}
                        className="pointer-events-auto rounded-full bg-black/45 p-2 text-white backdrop-blur hover:bg-black/60"
                        aria-label="More"
                        title="More"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Bottom text overlay */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-4">
                      <div className="pointer-events-auto">
                        <Link href={channelHref} className="text-sm font-semibold text-white hover:underline">
                          {profile?.username || (handle ? `@${handle}` : 'Channel')}
                        </Link>
                        <div className="mt-1 line-clamp-2 text-base font-semibold text-white">{item.title}</div>
                      </div>
                    </div>

                    {/* More menu */}
                    {menuOpenFor === item.id ? (
                      <div className="absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/95 p-1 text-sm text-zinc-100 backdrop-blur">
                        <Link
                          href={`/watch/${item.id}`}
                          className="block rounded-xl px-3 py-2 hover:bg-white/10"
                          onClick={() => setMenuOpenFor(null)}
                        >
                          Open watch page
                        </Link>
                        <button
                          type="button"
                          className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
                          onClick={() => {
                            setMenuOpenFor(null);
                            void share(item.id);
                          }}
                        >
                          Copy link
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Right action rail */}
                  <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
                    <button
                      type="button"
                      onClick={() => void toggleLike(item.id)}
                      className={[
                        'flex w-16 flex-col items-center gap-1 rounded-2xl bg-black/35 p-3 text-white backdrop-blur hover:bg-black/55',
                        state.likedByMe ? 'ring-2 ring-white/30' : '',
                      ].join(' ')}
                      aria-label="Like"
                      title="Like"
                    >
                      <ThumbsUp className="h-6 w-6" />
                      <span className="text-xs font-semibold">{formatCount(state.likes)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleDislike(item.id)}
                      className={[
                        'flex w-16 flex-col items-center gap-1 rounded-2xl bg-black/35 p-3 text-white backdrop-blur hover:bg-black/55',
                        state.dislikedByMe ? 'ring-2 ring-white/30' : '',
                      ].join(' ')}
                      aria-label="Dislike"
                      title="Dislike"
                    >
                      <ThumbsDown className="h-6 w-6" />
                      <span className="text-xs font-semibold">{formatCount(state.dislikes)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCommentsOpenFor(item.id)}
                      className="flex w-16 flex-col items-center gap-1 rounded-2xl bg-black/35 p-3 text-white backdrop-blur hover:bg-black/55"
                      aria-label="Comments"
                      title="Comments"
                    >
                      <MessageCircle className="h-6 w-6" />
                      <span className="text-xs font-semibold">{formatCount(state.comments)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void share(item.id)}
                      className="flex w-16 flex-col items-center gap-1 rounded-2xl bg-black/35 p-3 text-white backdrop-blur hover:bg-black/55"
                      aria-label="Share"
                      title="Share"
                    >
                      <Share2 className="h-6 w-6" />
                      <span className="text-xs font-semibold">Share</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {commentsOpenFor ? (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur">
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Comments</h3>
                <button
                  type="button"
                  onClick={() => setCommentsOpenFor(null)}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Close
                </button>
              </div>
              <div className="mt-4">
                {(() => {
                  const video = shorts.find((s) => s.id === commentsOpenFor);
                  if (!video) return null;
                  return (
                    <CommentSection
                      videoId={video.id}
                      commentsEnabled={video.comments_enabled !== false}
                      currentUserId={currentUserId}
                      videoOwnerId={video.user_id}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
