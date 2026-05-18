'use client';

import { useEffect, useState } from 'react';

function playAlertSound() {
  // Subtle, short beep. If browser blocks autoplay audio, it will just no-op.
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o.stop(now + 0.36);
    o.onended = () => {
      ctx.close().catch(() => null);
    };
  } catch {
    // ignore
  }
}

export function SiteAlertBanner({
  id,
  message,
  expiresAt,
  soundEnabled,
}: {
  id: string;
  message: string;
  expiresAt: string | null;
  soundEnabled: boolean;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (soundEnabled) playAlertSound();

    const now = Date.now();
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
    const remaining =
      Number.isFinite(expiresMs) ? Math.max(0, expiresMs - now) : 60_000;

    const t = window.setTimeout(() => setHidden(true), remaining);
    return () => window.clearTimeout(t);
  }, [id, expiresAt, soundEnabled]);

  if (hidden) return null;

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      <div className="mx-auto mt-4 flex max-w-[900px] justify-center px-3">
        <div className="pointer-events-auto w-full rounded-2xl border border-red-300/30 bg-red-600 text-white shadow-lg shadow-black/20 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm sm:px-5">
            <p className="whitespace-pre-wrap">{message}</p>
            <button
              type="button"
              onClick={() => setHidden(true)}
              aria-label="Dismiss alert"
              className="shrink-0 rounded-md px-2 py-1 text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-b-2xl bg-white/15">
            <div className="h-full w-full origin-left animate-[vt_alert_bar_60s_linear_forwards] bg-white/70" />
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes vt_alert_bar_60s_linear_forwards {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
