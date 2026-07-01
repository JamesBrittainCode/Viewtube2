'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const INTRO_LAST_PLAYED_KEY = 'viewtube_intro_last_played_at';
const INTRO_PENDING_KEY = 'viewtube_intro_pending';
const INTRO_EVENT = 'viewtube-play-intro';
const INTRO_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type IntroState = 'hidden' | 'ready' | 'blocked' | 'fading';

export function ViewTubeIntro() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<IntroState>('hidden');

  const markIntroPlayed = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_LAST_PLAYED_KEY, String(Date.now()));
    } catch {
      // Local storage can be unavailable in private or restricted contexts.
    }
  }, []);

  const closeIntro = useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    setState('fading');
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setState('hidden');
      markIntroPlayed();
    }, 700);
  }, [markIntroPlayed]);

  const requestIntro = useCallback(({ force = false }: { force?: boolean } = {}) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !force) return;

    try {
      const lastPlayed = Number(window.localStorage.getItem(INTRO_LAST_PLAYED_KEY) || 0);
      if (!force && lastPlayed && Date.now() - lastPlayed < INTRO_COOLDOWN_MS) return;
    } catch {
      // If localStorage is unavailable, still let the intro play.
    }

    setState('ready');
  }, []);

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
      setState('blocked');
    }
  }, []);

  useEffect(() => {
    if (state !== 'ready') return;
    const frame = window.requestAnimationFrame(() => void playVisibleIntro());
    return () => window.cancelAnimationFrame(frame);
  }, [playVisibleIntro, state]);

  useEffect(() => {
    const onPlayIntro = () => requestIntro({ force: true });
    window.addEventListener(INTRO_EVENT, onPlayIntro);

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        window.dispatchEvent(new Event(INTRO_EVENT));
      }
    });

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
      requestIntro({ force: pending });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(INTRO_EVENT, onPlayIntro);
      subscription.unsubscribe();
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
      {state === 'blocked' ? (
        <button
          type="button"
          onClick={() => void playVisibleIntro()}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-6 py-3 text-sm font-bold text-zinc-950 shadow-2xl transition hover:scale-105"
        >
          Tap to start ViewTube
        </button>
      ) : null}
      <button
        type="button"
        onClick={closeIntro}
        className="absolute right-5 top-5 z-10 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
      >
        Skip
      </button>
    </div>
  );
}
