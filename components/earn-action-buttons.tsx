'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

function GradientLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full px-4 py-2 text-xs font-semibold text-white',
        'bg-zinc-950 dark:bg-zinc-900',
        'ring-1 ring-white/10 hover:ring-white/20',
        'transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_30px_rgba(244,63,94,0.20)] active:scale-[0.98]',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          'bg-[length:200%_200%] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400',
          'animate-[vtGradient_3.5s_ease_infinite]',
        ].join(' ')}
      />
      <span className="absolute inset-0 bg-black/35" />
      <span className="relative z-10">{children}</span>
      <style jsx>{`
        @keyframes vtGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </Link>
  );
}

function GradientButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full px-4 py-2 text-xs font-semibold text-white',
        'bg-zinc-950 dark:bg-zinc-900',
        'ring-1 ring-white/10 hover:ring-white/20',
        'transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_30px_rgba(244,63,94,0.20)] active:scale-[0.98]',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          'bg-[length:200%_200%] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400',
          'animate-[vtGradient_3.5s_ease_infinite]',
        ].join(' ')}
      />
      <span className="absolute inset-0 bg-black/35" />
      <span className="relative z-10">{children}</span>
      <style jsx>{`
        @keyframes vtGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </button>
  );
}

export function EarnActionButtons({
  referralLink,
}: {
  referralLink: string | null;
}) {
  const [showReferral, setShowReferral] = useState(false);
  const [copied, setCopied] = useState(false);

  const linkLabel = useMemo(() => {
    if (!referralLink) return null;
    try {
      const url = new URL(referralLink);
      return `${url.host}${url.pathname}`;
    } catch {
      return referralLink;
    }
  }, [referralLink]);

  async function copy() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <GradientLink href="/streaks/ad">Watch an ad for +30</GradientLink>

      {referralLink ? (
        <>
          <GradientButton onClick={() => setShowReferral((v) => !v)}>
            {showReferral ? 'Hide referral link' : 'Get referral link (+50)'}
          </GradientButton>
          {showReferral ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                {linkLabel}
              </code>
              <button
                type="button"
                onClick={() => void copy()}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-zinc-900 ring-1 ring-zinc-200 hover:bg-white dark:text-white dark:ring-zinc-800 dark:hover:bg-white/10"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

