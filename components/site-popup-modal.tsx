'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { VerifiedBadge } from '@/components/verified-badge';
import { AdminBadge } from '@/components/admin-badge';
import { displayHandle } from '@/lib/handle';

function playPopupSound() {
  try {
    const AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = 740;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.10, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    o.stop(now + 0.43);
    o.onended = () => ctx.close().catch(() => null);
  } catch {
    // ignore
  }
}

export function SitePopupModal({
  id,
  message,
  expiresAt,
  soundEnabled,
  admin,
}: {
  id: string;
  message: string;
  expiresAt: string | null;
  soundEnabled: boolean;
  admin: { username: string; handle: string; avatar_url: string | null; verified: boolean; is_admin?: boolean } | null;
}) {
  const [open, setOpen] = useState(true);
  const [remainingNowMs, setRemainingNowMs] = useState<number | null>(null);

  const remainingMs = useMemo(() => {
    if (!expiresAt) return 60_000;
    const t = new Date(expiresAt).getTime();
    const now = Date.now();
    return Number.isFinite(t) ? Math.max(0, t - now) : 60_000;
  }, [expiresAt]);

  const totalMs = useMemo(() => {
    if (!expiresAt) return 60_000;
    const t = new Date(expiresAt).getTime();
    if (!Number.isFinite(t)) return 60_000;
    const total = t - Date.now();
    // If total is tiny/negative due to clock skew, fallback to remaining.
    return Math.max(1_000, Math.max(total, remainingMs));
  }, [expiresAt, remainingMs]);

  useEffect(() => {
    setOpen(true);
    if (soundEnabled) playPopupSound();
    setRemainingNowMs(remainingMs);
    const t = window.setTimeout(() => setOpen(false), remainingMs);
    return () => window.clearTimeout(t);
  }, [id, remainingMs, soundEnabled]);

  useEffect(() => {
    if (!open) return;
    setRemainingNowMs(remainingMs);
    const interval = window.setInterval(() => {
      setRemainingNowMs((prev) => {
        const base = typeof prev === 'number' ? prev : remainingMs;
        return Math.max(0, base - 100);
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [open, remainingMs]);

  if (!open) return null;

  const progress = (() => {
    const remaining = typeof remainingNowMs === 'number' ? remainingNowMs : remainingMs;
    const ratio = 1 - Math.min(1, Math.max(0, remaining / totalMs));
    return Math.round(ratio * 1000) / 1000;
  })();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-6"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-black/10 ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/10 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Message from admin
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Image
                src={admin?.avatar_url || '/avatar-placeholder.svg'}
                alt={admin?.username || 'Admin'}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {admin?.username || 'ViewTube Admin'}
                  </p>
                  {admin?.verified ? <VerifiedBadge className="h-4 w-4" /> : null}
                  {admin?.is_admin ? <AdminBadge className="h-4 w-4" /> : null}
                </div>
                <p className="truncate text-xs text-zinc-500">{displayHandle(admin?.handle, '@admin')}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            aria-label="Close popup"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-5">
          <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-100">{message}</p>
        </div>
        <div
          className="h-1 w-full bg-zinc-100 dark:bg-zinc-900"
          aria-hidden="true"
        >
          <div
            className="h-full bg-red-600 transition-[width] duration-100 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
