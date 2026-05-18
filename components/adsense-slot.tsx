'use client';

import { useEffect, useMemo, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdsenseSlot({
  slot,
  className,
  format = 'auto',
  responsive = true,
}: {
  slot: string;
  className?: string;
  format?: string;
  responsive?: boolean;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const requestedRef = useRef(false);
  const key = useMemo(() => `${client || 'no-client'}:${slot}`, [client, slot]);

  useEffect(() => {
    if (!client) return;
    // Prevent duplicate requests during React strict mode / re-renders.
    if (requestedRef.current) return;
    requestedRef.current = true;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // ignore
    }
  }, [client, key]);

  if (!client) return null;

  return (
    <ins
      key={key}
      className={`adsbygoogle block ${className || ''}`}
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}

