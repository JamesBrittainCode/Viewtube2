'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const INTRO_PENDING_KEY = 'viewtube_intro_pending';
const INTRO_LAST_PLAYED_KEY = 'viewtube_intro_last_played_at';
const INTRO_EVENT = 'viewtube-play-intro';
const INTRO_COOLDOWN_MS = 8 * 60 * 60 * 1000;

type IntroState = 'hidden' | 'ready' | 'fading';

export function ViewTubeIntro() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<IntroState>('hidden');

  const closeIntro = useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    setState('fading');
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setState('hidden');
    }, 700);
  }, []);

  const canPlayIntro = useCallback(() => {
    try {
      const lastPlayed = Number(window.localStorage.getItem(INTRO_LAST_PLAYED_KEY) || 0);
      return !lastPlayed || Date.now() - lastPlayed >= INTRO_COOLDOWN_MS;
    } catch {
      return true;
    }
  }, []);

  const markIntroPlayed = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_LAST_PLAYED_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable in private/restricted contexts.
    }
  }, []);

  const requestIntro = useCallback(({ ignoreReducedMotion = false }: { ignoreReducedMotion?: boolean } = {}) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !ignoreReducedMotion) return;
    if (!canPlayIntro()) return;
    markIntroPlayed();
    setState('ready');
  }, [canPlayIntro, markIntroPlayed]);

  const playVisibleIntro = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
      setState('ready');
    } catch {
      video.muted = true;
      try {
        await video.play();
        setState('ready');
      } catch {
        closeIntro();
      }
    }
  }, [closeIntro]);

  useEffect(() => {
    if (state !== 'ready') return;
    const frame = window.requestAnimationFrame(() => void playVisibleIntro());
    return () => window.cancelAnimationFrame(frame);
  }, [playVisibleIntro, state]);

  useEffect(() => {
    const onPlayIntro = () => requestIntro({ ignoreReducedMotion: true });
    window.addEventListener(INTRO_EVENT, onPlayIntro);

    const frame = window.requestAnimationFrame(() => {
      let pending = false;
      try {
        pending = window.sessionStorage.getItem(INTRO_PENDING_KEY) === 'true';
        if (pending) window.sessionStorage.removeItem(INTRO_PENDING_KEY);
      } catch {
        pending = false;
      }
      if (!pending && document.cookie.includes(`${INTRO_PENDING_KEY}=true`)) {
        pending = true;
        document.cookie = `${INTRO_PENDING_KEY}=; path=/; max-age=0; samesite=lax`;
      }
      if (pending) requestIntro({ ignoreReducedMotion: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(INTRO_EVENT, onPlayIntro);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, [requestIntro]);

  if (state === 'hidden') return null;

  return (
    <div
      className={[
        'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black transition-opacity duration-700',
        state === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
      aria-label="ViewTube intro"
      role="dialog"
    >
      <video
        ref={videoRef}
        src="/viewtube-intro.mp4"
        className="h-full w-full object-cover"
        playsInline
        preload="auto"
        onEnded={closeIntro}
        onError={closeIntro}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.55))]" />
    </div>
  );
}
