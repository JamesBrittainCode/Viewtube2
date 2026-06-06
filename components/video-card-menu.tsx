'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Ban,
  Clock,
  Download,
  Flag,
  ListPlus,
  MoreVertical,
  RotateCcw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react';
import { SaveToPlaylistsButton } from '@/components/save-to-playlists-button';
import { ReportVideoButton } from '@/components/report-video-button';

type Props = {
  videoId: string;
  title: string;
  videoUrl?: string | null;
  channelId?: string | null;
  signedIn?: boolean;
};

const HIDDEN_CHANNELS_KEY = 'viewtube:hidden-channels:v2';
const OLD_HIDDEN_CHANNELS_KEY = 'viewtube:hidden-channels';

function readList(key: string) {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveUnique(key: string, value: string) {
  if (typeof window === 'undefined') return;
  const next = Array.from(new Set([...readList(key), value]));
  window.localStorage.setItem(key, JSON.stringify(next));
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Request failed';
  } catch {
    return text || 'Request failed';
  }
}

export function VideoCardMenu({ videoId, title, videoUrl, channelId, signedIn = false }: Props) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasHiddenChannels, setHasHiddenChannels] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.localStorage.removeItem(OLD_HIDDEN_CHANNELS_KEY);
    const hiddenVideos = new Set([
      ...readList('viewtube:never-watch'),
      ...readList('viewtube:not-interested'),
    ]);
    const hiddenChannels = new Set(readList(HIDDEN_CHANNELS_KEY));
    setHasHiddenChannels(hiddenChannels.size > 0);
    if (!hiddenVideos.has(videoId) && (!channelId || !hiddenChannels.has(channelId))) return;
    const card = rootRef.current?.closest<HTMLElement>('[data-video-card]');
    if (card) card.style.display = 'none';
  }, [channelId, videoId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  function requireSignIn() {
    if (signedIn) return false;
    window.location.href = `/sign-in?next=${encodeURIComponent(`/watch/${videoId}`)}`;
    return true;
  }

  function hideCard(reason: string) {
    setOpen(false);
    setMessage(reason);
    const card = rootRef.current?.closest<HTMLElement>('[data-video-card]');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.98)';
      window.setTimeout(() => {
        card.style.display = 'none';
      }, 180);
    }
  }

  async function share() {
    setOpen(false);
    const url = `${window.location.origin}${videoId ? `/watch/${videoId}` : ''}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setMessage('Link copied');
  }

  function addToQueue() {
    saveUnique('viewtube:queue', videoId);
    setOpen(false);
    setMessage('Added to queue');
  }

  async function saveToWatchLater() {
    if (requireSignIn()) return;
    setWorking('watch-later');
    try {
      const listRes = await fetch(`/api/playlists?videoId=${encodeURIComponent(videoId)}`, { cache: 'no-store' });
      if (!listRes.ok) throw new Error(await readError(listRes));
      const listPayload = (await listRes.json()) as {
        playlists?: Array<{ id: string; is_watch_later?: boolean; containsVideo?: boolean }>;
      };
      const watchLater = (listPayload.playlists || []).find((playlist) => playlist.is_watch_later);
      if (!watchLater?.id) throw new Error('Watch later playlist was not found.');
      if (!watchLater.containsVideo) {
        const saveRes = await fetch(`/api/playlists/${watchLater.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId }),
        });
        if (!saveRes.ok) throw new Error(await readError(saveRes));
      }
      setOpen(false);
      setMessage(watchLater.containsVideo ? 'Already in Watch later' : 'Saved to Watch later');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(null);
    }
  }

  function notInterested() {
    saveUnique('viewtube:not-interested', videoId);
    hideCard('Removed from your feed');
  }

  function dontRecommendChannel() {
    if (channelId) saveUnique(HIDDEN_CHANNELS_KEY, channelId);
    hideCard('Channel hidden from this device');
  }

  function resetHiddenChannels() {
    window.localStorage.removeItem(HIDDEN_CHANNELS_KEY);
    window.localStorage.removeItem(OLD_HIDDEN_CHANNELS_KEY);
    setHasHiddenChannels(false);
    setOpen(false);
    setMessage('Hidden channels reset');
    window.setTimeout(() => window.location.reload(), 350);
  }

  const itemClass =
    'flex min-h-11 w-full items-center gap-5 px-4 py-2.5 text-left text-[15px] font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60';
  const iconClass = 'h-6 w-6 shrink-0 text-zinc-100';

  return (
    <div ref={rootRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 opacity-80 transition hover:bg-zinc-100 hover:text-zinc-900 group-hover:opacity-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        aria-label="More video actions"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close video menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl bg-[#282828] py-2 text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            <button
              type="button"
              onClick={addToQueue}
              className={itemClass}
            >
              <ListPlus className={iconClass} />
              Add to queue
            </button>
            <button
              type="button"
              onClick={() => void saveToWatchLater()}
              disabled={working === 'watch-later'}
              className={itemClass}
            >
              <Clock className={iconClass} />
              {working === 'watch-later' ? 'Saving…' : 'Save to Watch later'}
            </button>
            <SaveToPlaylistsButton videoId={videoId} signedIn={signedIn} variant="menu" />
            {videoUrl ? (
              <a
                href={videoUrl}
                download
                target="_blank"
                rel="noreferrer"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <Download className={iconClass} />
                Download
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void share()}
              className={itemClass}
            >
              <Share2 className={iconClass} />
              Share
            </button>
            <div className="my-2 h-px bg-white/10" />
            <button
              type="button"
              onClick={notInterested}
              className={itemClass}
            >
              <Ban className={iconClass} />
              Not interested
            </button>
            <button
              type="button"
              onClick={dontRecommendChannel}
              className={itemClass}
            >
              <SlidersHorizontal className={iconClass} />
              Don&apos;t recommend channel
            </button>
            {hasHiddenChannels ? (
              <button
                type="button"
                onClick={resetHiddenChannels}
                className={itemClass}
              >
                <RotateCcw className={iconClass} />
                Show hidden channels again
              </button>
            ) : null}
            {signedIn ? (
              <ReportVideoButton videoId={videoId} variant="menu" />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.location.href = `/sign-in?next=${encodeURIComponent(`/watch/${videoId}`)}`;
                }}
                className={itemClass}
              >
                <Flag className={iconClass} />
                Sign in to report
              </button>
            )}
          </div>
        </>
      ) : null}

      {message ? (
        <div className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-2xl dark:bg-zinc-800 dark:text-white">
          {message}
        </div>
      ) : null}
    </div>
  );
}
