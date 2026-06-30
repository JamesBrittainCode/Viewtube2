'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SponsoredHomeBanner } from '@/components/ads/sponsored-home-banner';
import { VideoCard } from '@/components/video-card';

type SponsoredBannerAd = {
  id: string;
  title: string;
  image_url: string;
  click_url: string;
};

const DEFAULT_HILLTOP_HOME_BANNER_SCRIPT_SRCS = [
  '//pricklyassociation.com/bXXKVss.dFGalg0/YnWAcN/ZefmR9/ujZ/U/l/kBPsTXcDxVN/zbE/yYM/TUMktDNyz/E/3/MjT_IVxTNAwN',
  '//pricklyassociation.com/bpXFV.sXd/G/lb0zYuW/cd/ueUmW9/uaZgU/llkTPHTJcux-N/zwgp3IM/z/MDtmNZzDEO3LOEDJcDzWNCwh',
];

function getHilltopScriptSources() {
  const envSources = process.env.NEXT_PUBLIC_HILLTOP_HOME_BANNER_SCRIPT_SRC?.trim();
  if (!envSources) return DEFAULT_HILLTOP_HOME_BANNER_SCRIPT_SRCS;
  return envSources
    .split(',')
    .map((src) => src.trim())
    .filter(Boolean);
}

function pickRandomItem(items: string[]) {
  if (!items.length) return '';
  return items[Math.floor(Math.random() * items.length)];
}

function hasAdContent(container: HTMLDivElement | null) {
  if (!container) return false;
  return Boolean(
    container.querySelector('iframe, img, object, embed, ins, a[href], canvas') ||
      container.textContent?.trim()
  );
}

function executeHtmlSnippet(container: HTMLDivElement, html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const scripts = Array.from(template.content.querySelectorAll('script'));
  scripts.forEach((script) => script.remove());
  container.appendChild(template.content.cloneNode(true));

  for (const oldScript of scripts) {
    const script = document.createElement('script');
    for (const attr of Array.from(oldScript.attributes)) {
      script.setAttribute(attr.name, attr.value);
    }
    script.text = oldScript.text;
    container.appendChild(script);
  }
}

function HilltopHomeBanner({
  onAvailabilityChange,
}: {
  onAvailabilityChange: (available: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const scriptSrc = useMemo(() => pickRandomItem(getHilltopScriptSources()), []);
  const htmlSnippet = process.env.NEXT_PUBLIC_HILLTOP_HOME_BANNER_HTML || '';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const src = scriptSrc.trim();
    const html = htmlSnippet.trim();
    if (!src && !html) {
      setIsConfigured(false);
      onAvailabilityChange(false);
      return;
    }

    let settled = false;
    const setAvailable = (available: boolean) => {
      if (settled && !available) return;
      settled = available;
      onAvailabilityChange(available);
    };

    const observer = new MutationObserver(() => {
      if (hasAdContent(container)) setAvailable(true);
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    if (html) executeHtmlSnippet(container, html);
    if (src) {
      const script = document.createElement('script') as HTMLScriptElement & {
        settings?: Record<string, never>;
      };
      script.settings = {};
      script.async = true;
      script.src = src;
      script.referrerPolicy = 'no-referrer-when-downgrade';
      script.onerror = () => setAvailable(false);
      container.appendChild(script);
    }

    if (hasAdContent(container)) setAvailable(true);
    const timeout = window.setTimeout(() => {
      if (!hasAdContent(container)) setAvailable(false);
    }, 4500);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
      container.replaceChildren();
    };
  }, [htmlSnippet, onAvailabilityChange, scriptSrc]);

  if (!isConfigured) return null;

  return (
    <article className="group">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
        <div className="flex h-full w-full items-center justify-center p-2">
          <div
            ref={containerRef}
            className="flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg [&_canvas]:max-h-full [&_canvas]:max-w-full [&_embed]:max-h-full [&_embed]:max-w-full [&_iframe]:max-h-full [&_iframe]:max-w-full [&_img]:max-h-full [&_img]:max-w-full [&_object]:max-h-full [&_object]:max-w-full"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">
          Ad
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-950 dark:text-white">
            Sponsored
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Ad · Learn more from this sponsor
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => containerRef.current?.querySelector<HTMLElement>('a[href], iframe')?.focus()}
              className="min-w-28 rounded-full bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              Watch
            </button>
            <button
              type="button"
              onClick={() => containerRef.current?.querySelector<HTMLElement>('a[href], iframe')?.focus()}
              className="min-w-28 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 dark:bg-white dark:hover:bg-zinc-200"
            >
              Learn more
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function HomeAdSlot({
  fallbackAd,
  videos,
  signedIn,
}: {
  fallbackAd: SponsoredBannerAd | null;
  videos: Array<Record<string, unknown>>;
  signedIn: boolean;
}) {
  const [networkAvailable, setNetworkAvailable] = useState<boolean | null>(null);
  const hasHilltopConfig = useMemo(
    () =>
      Boolean(
        getHilltopScriptSources().length ||
          process.env.NEXT_PUBLIC_HILLTOP_HOME_BANNER_HTML?.trim()
      ),
    []
  );

  if (!hasHilltopConfig && !fallbackAd) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {videos.map((video) => (
          <VideoCard key={video.id as string} video={video as never} signedIn={signedIn} />
        ))}
      </div>
    );
  }

  return (
    <>
      {hasHilltopConfig && networkAvailable !== false ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <HilltopHomeBanner onAvailabilityChange={setNetworkAvailable} />
          {videos.map((video) => (
            <VideoCard key={video.id as string} video={video as never} signedIn={signedIn} />
          ))}
        </div>
      ) : null}
      {networkAvailable === false || !hasHilltopConfig ? (
        <>
          {fallbackAd ? (
            <div className="mb-4">
              <div className="mx-auto max-w-[1200px]">
                <SponsoredHomeBanner ad={fallbackAd} />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id as string} video={video as never} signedIn={signedIn} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
