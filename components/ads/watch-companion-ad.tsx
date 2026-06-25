'use client';

import { useEffect, useState } from 'react';
import { AdCompanionCard } from '@/components/ads/ad-companion-card';

type CompanionAd = {
  id: string;
  title: string;
  click_url: string;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
};

type WatchAdEvent = CustomEvent<{
  videoId?: string;
  ad?: CompanionAd | null;
}>;

export function WatchCompanionAd({ videoId }: { videoId: string }) {
  const [ad, setAd] = useState<CompanionAd | null>(null);

  useEffect(() => {
    const storageKey = `viewtube:last-watch-ad:${videoId}`;
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        setAd(JSON.parse(saved) as CompanionAd);
      } catch {
        window.sessionStorage.removeItem(storageKey);
      }
    } else {
      setAd(null);
    }

    function onWatchAd(event: Event) {
      const detail = (event as WatchAdEvent).detail || {};
      if (detail.videoId !== videoId) return;
      setAd(detail.ad || null);
    }

    window.addEventListener('viewtube-watch-ad', onWatchAd);
    return () => window.removeEventListener('viewtube-watch-ad', onWatchAd);
  }, [videoId]);

  return ad ? <AdCompanionCard ad={ad} /> : null;
}
