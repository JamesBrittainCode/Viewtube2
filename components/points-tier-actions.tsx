'use client';

import { useMemo, useState } from 'react';
import { GradientActionButton, GradientActionLink } from '@/components/gradient-action';

export function ReferralTierAction({ referralLink }: { referralLink: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const label = useMemo(() => {
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

  if (!referralLink) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <GradientActionButton onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide link' : 'Get link'}
      </GradientActionButton>
      {open ? (
        <>
          <code className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            {label}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-900 ring-1 ring-zinc-200 hover:bg-white dark:text-white dark:ring-zinc-800 dark:hover:bg-white/10"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </>
      ) : null}
    </div>
  );
}

export function WatchAdTierAction() {
  return <GradientActionLink href="/streaks/ad">Watch ad</GradientActionLink>;
}

