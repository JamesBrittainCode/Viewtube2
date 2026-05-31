'use client';

import Script from 'next/script';
import { AdsenseSlot } from '@/components/adsense-slot';
import { AdsterraBanner } from '@/components/adsterra-banner';

let adsenseScriptLoaded = false;

export function AdSlot({
  className,
  // AdSense
  adsenseSlot,
  // Adsterra
  adsterraUnitKey,
  adsterraWidth,
  adsterraHeight,
}: {
  className?: string;
  adsenseSlot: string | null;
  adsterraUnitKey: string | null;
  adsterraWidth?: number;
  adsterraHeight?: number;
}) {
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || null;

  // Prefer AdSense if configured, otherwise fall back to Adsterra.
  const canUseAdsense = Boolean(adsenseClient && adsenseSlot);
  const canUseAdsterra = Boolean(adsterraUnitKey);

  if (!canUseAdsense && !canUseAdsterra) return null;

  return (
    <>
      {canUseAdsense ? (
        <>
          {!adsenseScriptLoaded ? (
            <Script
              id="adsense-js"
              async
              strategy="afterInteractive"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
                adsenseClient!,
              )}`}
              crossOrigin="anonymous"
              onLoad={() => {
                adsenseScriptLoaded = true;
              }}
            />
          ) : null}
          <AdsenseSlot slot={adsenseSlot!} className={className} />
        </>
      ) : (
        <AdsterraBanner
          unitKey={adsterraUnitKey!}
          width={adsterraWidth}
          height={adsterraHeight}
          className={className}
        />
      )}
    </>
  );
}

