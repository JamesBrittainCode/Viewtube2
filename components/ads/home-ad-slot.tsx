'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SponsoredHomeBanner } from '@/components/ads/sponsored-home-banner';

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div ref={containerRef} className="mx-auto min-h-[90px] w-full overflow-hidden" />
    </div>
  );
}

export function HomeAdSlot({ fallbackAd }: { fallbackAd: SponsoredBannerAd | null }) {
  const [networkAvailable, setNetworkAvailable] = useState<boolean | null>(null);
  const hasHilltopConfig = useMemo(
    () =>
      Boolean(
        getHilltopScriptSources().length ||
          process.env.NEXT_PUBLIC_HILLTOP_HOME_BANNER_HTML?.trim()
      ),
    []
  );

  if (!hasHilltopConfig && !fallbackAd) return null;

  return (
    <div className="mb-4">
      <div className="mx-auto max-w-[1200px]">
        {hasHilltopConfig && networkAvailable !== false ? (
          <HilltopHomeBanner onAvailabilityChange={setNetworkAvailable} />
        ) : null}
        {networkAvailable === false || !hasHilltopConfig ? (
          fallbackAd ? <SponsoredHomeBanner ad={fallbackAd} /> : null
        ) : null}
      </div>
    </div>
  );
}
