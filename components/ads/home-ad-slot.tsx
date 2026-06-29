'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SponsoredHomeBanner } from '@/components/ads/sponsored-home-banner';

type SponsoredBannerAd = {
  id: string;
  title: string;
  image_url: string;
  click_url: string;
};

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
  const scriptSrc = process.env.NEXT_PUBLIC_HILLTOP_HOME_BANNER_SCRIPT_SRC || '';
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
      const script = document.createElement('script');
      script.async = true;
      script.src = src;
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
        process.env.NEXT_PUBLIC_HILLTOP_HOME_BANNER_SCRIPT_SRC?.trim() ||
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
