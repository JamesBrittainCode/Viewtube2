'use client';

import Script from 'next/script';
import { useMemo } from 'react';

declare global {
  interface Window {
    atOptions?: unknown;
  }
}

// Adsterra banner embed using their standard "invoke.js" snippet.
// You must set NEXT_PUBLIC_ADSTERRA_*_KEY to the Adsterra unit key.

export function AdsterraBanner({
  unitKey,
  width = 728,
  height = 90,
  className,
}: {
  unitKey: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const ids = useMemo(() => {
    const suffix = Math.random().toString(16).slice(2);
    return {
      holder: `adsterra-holder-${unitKey}-${suffix}`,
      options: `adsterra-options-${unitKey}-${suffix}`,
      invoke: `adsterra-invoke-${unitKey}-${suffix}`,
    };
  }, [unitKey]);

  if (!unitKey) return null;

  return (
    <div id={ids.holder} className={className} style={{ width, height }}>
      <Script
        id={ids.options}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `atOptions = {'key':'${unitKey}','format':'iframe','height':${height},'width':${width},'params':{}};`,
        }}
      />
      <Script
        id={ids.invoke}
        async
        strategy="afterInteractive"
        src={`https://www.highperformanceformat.com/${encodeURIComponent(unitKey)}/invoke.js`}
      />
    </div>
  );
}
