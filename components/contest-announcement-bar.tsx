'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { VIEWTUBE_CONTEST_END_MS, VIEWTUBE_CONTEST_SHORT_LABEL } from '@/lib/contest';

const STORAGE_KEY = 'vtContestAnnouncement';

export function ContestAnnouncementBar() {
  const [visible, setVisible] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const updateEnded = () => {
      const isEnded = Date.now() >= VIEWTUBE_CONTEST_END_MS;
      setEnded(isEnded);
      if (isEnded) setVisible(true);
    };
    updateEnded();
    const timer = window.setInterval(updateEnded, 1000);

    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved === '1') setVisible(true);

    function onShow() {
      setVisible(true);
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    window.addEventListener('vt-contest-announcement-show', onShow);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('vt-contest-announcement-show', onShow);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="relative z-[60] w-full animate-[vtSlideDown_450ms_ease-out] bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 text-white">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-3 py-2 text-sm sm:px-4 lg:px-6">
        <div className="min-w-0 truncate">
          <span className="font-extrabold tracking-wide">WATCH VIEWTUBE</span>{' '}
          <span className="font-black">{ended ? 'CONTEST ENDED 🎉' : 'WIN BIG'}</span>{' '}
          <span className="opacity-90">
            • {ended ? 'Winner verification is underway' : `Contest ends ${VIEWTUBE_CONTEST_SHORT_LABEL}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/streaks"
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
          >
            View leaderboard
          </Link>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              window.localStorage.removeItem(STORAGE_KEY);
            }}
            className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
            aria-label="Dismiss announcement"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes vtSlideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
