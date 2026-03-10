'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'vt_site_alert_dismissed';

export function SiteAlertBanner({ id, message }: { id: string; message: string }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY);
      setHidden(dismissed === id);
    } catch {
      setHidden(false);
    }
  }, [id]);

  if (hidden) return null;

  return (
    <div className="bg-red-600 text-white">
      <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-3 px-3 py-2 text-sm sm:px-4 lg:px-6">
        <p className="whitespace-pre-wrap">{message}</p>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try {
              window.localStorage.setItem(DISMISS_KEY, id);
            } catch {}
          }}
          aria-label="Dismiss alert"
          className="shrink-0 rounded-md px-2 py-1 text-white/90 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
