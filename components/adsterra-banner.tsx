'use client';

import { useEffect, useMemo, useRef } from 'react';

declare global {
  interface Window {
    atOptions?: unknown;
  }
}

// Adsterra banner embed via "invoke.js" snippet.
// You must set NEXT_PUBLIC_ADSTERRA_*_KEY to the Adsterra unit key.
// Notes:
// - Adsterra uses a global `atOptions` object read by the injected script.
// - To avoid collisions when rendering multiple units, we serialize script injection.
let injectionQueue: Promise<void> = Promise.resolve();

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
  const containerId = useMemo(() => `adsterra-${unitKey}-${Math.random().toString(16).slice(2)}`, [unitKey]);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!unitKey) return;
    if (injectedRef.current) return;
    injectedRef.current = true;

    injectionQueue = injectionQueue.then(async () => {
      // If the container disappeared, abort.
      const container = document.getElementById(containerId);
      if (!container) return;

      // Configure this unit for the next injected script.
      window.atOptions = {
        key: unitKey,
        format: 'iframe',
        height,
        width,
        params: {},
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://www.highperformanceformat.com/${encodeURIComponent(unitKey)}/invoke.js`;

      // Ensure we append right after container to match typical snippets.
      container.appendChild(script);

      await new Promise<void>((resolve) => {
        script.onload = () => resolve();
        script.onerror = () => resolve();
      });
    });
  }, [containerId, height, unitKey, width]);

  return <div id={containerId} className={className} style={{ width, height }} />;
}

