'use client';

import Link from 'next/link';
import { Captions, Maximize2, Minimize2, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  id: string;
  videoUrl: string;
  captionSource?: string | null;
};

type AdDecision = {
  id: string;
  title: string;
  video_url: string;
  click_url: string;
  thumbnail_url?: string | null;
  skippable: boolean;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const sec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type CaptionCue = {
  start: number;
  end: number;
  text: string;
};

function buildAutoCaptions(text: string, totalDuration: number): CaptionCue[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned || totalDuration <= 0) return [];

  const chunks = cleaned
    .split(/(?<=[.!?])\s+/)
    .flatMap((line) => {
      if (line.length <= 70) return [line];
      const words = line.split(' ');
      const out: string[] = [];
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 70) {
          if (current) out.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) out.push(current);
      return out;
    })
    .map((line) => line.trim())
    .filter(Boolean);

  if (!chunks.length) return [];

  const minCueDuration = 2.2;
  const maxCues = Math.max(1, Math.floor(totalDuration / minCueDuration));
  const selected = chunks.slice(0, maxCues);
  const cueDuration = totalDuration / selected.length;

  return selected.map((line, idx) => ({
    start: idx * cueDuration,
    end: idx === selected.length - 1 ? totalDuration : (idx + 1) * cueDuration,
    text: line,
  }));
}

export function VideoPlayer({ id, videoUrl, captionSource }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ad, setAd] = useState<AdDecision | null>(null);
  const [sourceUrl, setSourceUrl] = useState(videoUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<'main' | 'ad'>('main');
  const [adChecked, setAdChecked] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [mainPlaybackStarted, setMainPlaybackStarted] = useState(false);
  const [pendingAutoplay, setPendingAutoplay] = useState(false);
  const [autoplayPrimed, setAutoplayPrimed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>([]);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);

  useEffect(() => {
    const key = `viewed:${id}`;

    if (sessionStorage.getItem(key)) return;

    fetch(`/api/videos/${id}/view`, { method: 'POST' })
      .then(() => sessionStorage.setItem(key, '1'))
      .catch(() => null);
  }, [id]);

  useEffect(() => {
    setSourceUrl(videoUrl);
    setMode('main');
    setAd(null);
    setAdChecked(false);
    setCurrentTime(0);
    setDuration(0);
    setAdCountdown(5);
    setMainPlaybackStarted(false);
    setIsPlaying(false);
    setPendingAutoplay(false);
    setAutoplayPrimed(false);
    setCaptionCues([]);
    setActiveCaption(null);
  }, [id, videoUrl]);

  useEffect(() => {
    function onFullscreenChange() {
      const container = containerRef.current;
      setIsFullscreen(Boolean(container && document.fullscreenElement === container));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (mode !== 'main') {
      setActiveCaption(null);
      return;
    }
    const text = String(captionSource || '').trim();
    if (!text || !duration || !Number.isFinite(duration)) {
      setCaptionCues([]);
      setActiveCaption(null);
      return;
    }
    const cues = buildAutoCaptions(text, duration);
    setCaptionCues(cues);
  }, [captionSource, duration, mode]);

  async function chooseAdIfEligible() {
    if (adChecked) return;
    setAdChecked(true);

    try {
      const res = await fetch('/api/ads/decision?eligible=1', { cache: 'no-store' });
      const data = (await res.json()) as { ad?: AdDecision | null };
      if (!data.ad) return;

      setAd(data.ad);
      setMode('ad');
      setSourceUrl(data.ad.video_url);
      setCurrentTime(0);
      setDuration(0);
      setAdCountdown(5);
      setPendingAutoplay(true);
      return true;
    } catch {
      return false;
    }

    return false;
  }

  const captionsAvailable = captionCues.length > 0;

  async function startMainVideo() {
    setMode('main');
    setSourceUrl(videoUrl);
    setCurrentTime(0);
    setDuration(0);
    setPendingAutoplay(true);
  }

  async function onPlayPause() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (mode === 'main' && !mainPlaybackStarted) {
        setMainPlaybackStarted(true);
        const adLoaded = await chooseAdIfEligible();
        if (!adLoaded) {
          video.play().catch(() => null);
        }
        return;
      }

      video.play().catch(() => null);
    } else {
      video.pause();
    }
  }

  function onSeek(time: number) {
    if (mode === 'ad') return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, duration || 0));
  }

  function onSkipAd() {
    if (mode !== 'ad') return;
    if (!ad?.skippable || adCountdown > 0) return;
    void startMainVideo();
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement === container) {
      await document.exitFullscreen().catch(() => null);
      return;
    }
    await container.requestFullscreen().catch(() => null);
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-xl bg-black">
      <div className="relative aspect-video w-full">
        <video
          ref={videoRef}
          src={sourceUrl}
          preload="metadata"
          muted={isMuted}
          className="h-full w-full"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (!v) return;
            setCurrentTime(v.currentTime || 0);
            if (mode === 'main' && captionCues.length) {
              const cue = captionCues.find((item) => v.currentTime >= item.start && v.currentTime < item.end);
              setActiveCaption(cue?.text || null);
            } else {
              setActiveCaption(null);
            }
            if (mode === 'ad' && ad?.skippable) {
              setAdCountdown(Math.max(0, 5 - Math.floor(v.currentTime || 0)));
            }
          }}
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (!v) return;
            setDuration(v.duration || 0);
            if (pendingAutoplay) {
              setPendingAutoplay(false);
              v.play().catch(() => null);
              return;
            }

            if (!autoplayPrimed) {
              setAutoplayPrimed(true);
              if (mode === 'main' && !mainPlaybackStarted) {
                setMainPlaybackStarted(true);
                void chooseAdIfEligible().then((adLoaded) => {
                  if (!adLoaded) {
                    v.play().catch(() => null);
                  }
                });
              } else {
                v.play().catch(() => null);
              }
            }
          }}
          onEnded={() => {
            if (mode === 'ad') {
              void startMainVideo();
            }
          }}
          onClick={() => void onPlayPause()}
        />

        {mode === 'main' && captionsEnabled && activeCaption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-3">
            <p className="max-w-4xl rounded bg-black/75 px-2 py-1 text-center text-sm font-medium text-white">
              {activeCaption}
            </p>
          </div>
        )}

        {mode === 'ad' && (
          <div className="absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-yellow-300">
            Ad
          </div>
        )}

        {mode === 'ad' && ad?.click_url && (
          <Link
            href={ad.click_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-3 top-3 flex items-center gap-2 rounded bg-white/90 px-2 py-1 text-xs font-semibold text-zinc-900"
          >
            {ad.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.thumbnail_url} alt="" className="h-7 w-10 rounded object-cover" />
            ) : null}
            Visit Sponsor
          </Link>
        )}

        {mode === 'ad' && ad?.skippable && (
          <button
            type="button"
            onClick={onSkipAd}
            disabled={adCountdown > 0}
            className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1 text-xs text-white disabled:opacity-60"
          >
            {adCountdown > 0 ? `Skip in ${adCountdown}` : 'Skip Ad'}
          </button>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration || 0)}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={mode === 'ad'}
          style={{
            background: `linear-gradient(to right, ${
              mode === 'ad' ? '#eab308' : '#ef4444'
            } 0%, ${mode === 'ad' ? '#eab308' : '#ef4444'} ${
              duration > 0 ? (Math.min(currentTime, duration) / duration) * 100 : 0
            }%, #3f3f46 ${
              duration > 0 ? (Math.min(currentTime, duration) / duration) * 100 : 0
            }%, #3f3f46 100%)`,
          }}
          className={`h-1.5 w-full appearance-none rounded-full [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ${
            mode === 'ad'
              ? 'cursor-not-allowed opacity-90 [&::-moz-range-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:bg-yellow-400'
              : 'cursor-pointer [&::-moz-range-thumb]:bg-red-500 [&::-webkit-slider-thumb]:bg-red-500'
          }`}
        />

        <div className="flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onPlayPause()}
              className="rounded p-1 hover:bg-zinc-800"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsMuted((v) => !v)}
              className="rounded p-1 hover:bg-zinc-800"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              disabled={!captionsAvailable}
              onClick={() => setCaptionsEnabled((value) => !value)}
              title={captionsAvailable ? 'Toggle captions' : 'Captions unavailable (no speech transcript)'}
              className={`rounded p-1 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 ${
                captionsEnabled && captionsAvailable ? 'text-red-400' : 'text-zinc-300'
              }`}
            >
              <Captions className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} className="rounded p-1 hover:bg-zinc-800">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          <p>
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>
      </div>
    </div>
  );
}
