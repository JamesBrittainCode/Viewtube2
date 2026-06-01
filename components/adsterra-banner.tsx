'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
      script: `adsterra-script-${unitKey}-${suffix}`,
    };
  }, [unitKey]);

  const injectedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!unitKey) return;
    if (injectedRef.current) return;
    injectedRef.current = true;

    const holder = document.getElementById(ids.holder);
    if (!holder) return;

    // Clear previous content just in case.
    holder.innerHTML = '';

    // IMPORTANT: Adsterra's invoke.js often relies on synchronous execution.
    // We set `window.atOptions` then inject the script without `async`.
    window.atOptions = {
      key: unitKey,
      format: 'iframe',
      height,
      width,
      params: {},
    };

    const script = document.createElement('script');
    script.id = ids.script;
    script.type = 'text/javascript';
    script.async = false;
    script.src = `https://www.highperformanceformat.com/${encodeURIComponent(unitKey)}/invoke.js`;

    const timeout = window.setTimeout(() => setFailed(true), 2500);

    script.onload = () => {
      window.clearTimeout(timeout);
      setFailed(false);
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      setFailed(true);
    };

    holder.appendChild(script);
  }, [height, ids.holder, ids.script, unitKey, width]);

  if (!unitKey) return null;

  return (
    <div className={className} style={{ width, height }}>
      <div id={ids.holder} style={{ width, height }} />
      {failed ? (
        <div className="mt-1 text-[11px] text-zinc-500">
          Ad failed to load. Check ad blockers/privacy shields.
        </div>
      ) : null}
    </div>
  );
}
