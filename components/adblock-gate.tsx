'use client';

import { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function detectAdBlock(): Promise<boolean> {
  return new Promise((resolve) => {
    // DOM bait: many blockers hide known ad classes.
    const bait = document.createElement('div');
    bait.className = 'adsbygoogle ad adsbox ad-unit ad-banner';
    bait.style.cssText =
      'width:1px;height:1px;position:absolute;left:-10000px;top:-10000px;display:block;';
    document.body.appendChild(bait);

    const cleanup = () => {
      try {
        bait.remove();
      } catch {
        // ignore
      }
    };

    // Try to trigger adsbygoogle. Some blockers throw.
    let pushFailed = false;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      pushFailed = true;
    }

    window.setTimeout(() => {
      const style = window.getComputedStyle(bait);
      const hidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0;
      cleanup();
      resolve(pushFailed || hidden);
    }, 450);
  });
}

export function AdblockGate() {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const enabled = useMemo(() => {
    // Only gate when ads are configured. Keep dev experience sane.
    if (!adsenseClient) return false;
    if (process.env.NODE_ENV !== 'production') return false;
    return true;
  }, [adsenseClient]);

  const [checking, setChecking] = useState(enabled);
  const [blocked, setBlocked] = useState(false);

  async function runCheck() {
    if (!enabled) return;
    setChecking(true);
    try {
      const isBlocked = await detectAdBlock();
      setBlocked(isBlocked);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;
  if (!blocked && !checking) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-[520px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ad blocker detected
        </p>
        <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Please disable your ad blocker to continue
        </h2>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          ViewTube is supported by ads so you don’t have to pay. If you’re using an ad blocker,
          we can’t keep the site running for free.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={checking}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-white dark:text-zinc-900"
          >
            {checking ? 'Checking…' : 'I disabled it'}
          </button>
          <a
            href="https://support.google.com/adsense/answer/9274015"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
}

