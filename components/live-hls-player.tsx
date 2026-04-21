'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';

type Props = {
  manifestUrl: string;
  posterUrl?: string | null;
};

type WebkitFullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export function LiveHlsPlayer({ manifestUrl, posterUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Keep inline playback on mobile (avoid forced fullscreen).
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-playsinline', 'true');
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setIsPlaying(false);

    async function attach(videoEl: HTMLVideoElement) {
      // Safari can play HLS natively.
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = manifestUrl;
        return;
      }

      const mod = await import('hls.js');
      if (cancelled) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) {
        // Best-effort fallback.
        videoEl.src = manifestUrl;
        return;
      }

      const hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        backBufferLength: 15,
      });

      hls.loadSource(manifestUrl);
      hls.attachMedia(videoEl);
      hlsRef.current = hls;
    }

    void attach(video);

    return () => {
      cancelled = true;
      try {
        hlsRef.current?.destroy?.();
      } catch {
        // ignore
      }
      hlsRef.current = null;
      // Reset src to stop downloads.
      try {
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore
      }
    };
  }, [manifestUrl]);

  useEffect(() => {
    function onFullscreenChange() {
      const container = containerRef.current;
      setIsFullscreen(Boolean(container && document.fullscreenElement === container));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play().catch(() => null);
    } else {
      video.pause();
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    const video = videoRef.current as WebkitFullscreenVideo | null;
    if (!container || !video) return;
    if (isFullscreen) {
      await document.exitFullscreen?.().catch(() => null);
      return;
    }

    if (container.requestFullscreen) {
      await container.requestFullscreen().catch(() => null);
      return;
    }

    // iOS Safari fallback.
    video.webkitEnterFullscreen?.();
  }

  return (
    <div ref={containerRef} className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        poster={posterUrl || undefined}
        className="aspect-video w-full bg-black object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={() => void togglePlay()}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/65 to-transparent px-3 py-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/15"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/15"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/15"
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
