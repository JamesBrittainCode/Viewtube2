'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  creatorId: string;
  initialSubscribed: boolean;
  initialCount: number;
};

export function SubscribeButton({
  creatorId,
  initialSubscribed,
  initialCount,
}: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`profile-${creatorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${creatorId}`,
        },
        (payload) => {
          const nextCount = (payload.new as { subscribers_count?: number })
            ?.subscribers_count;
          if (typeof nextCount === 'number') setCount(nextCount);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorId]);

  async function toggleSubscription() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/subscriptions/${creatorId}`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setSubscribed(data.subscribed);
      setCount(data.count);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleSubscription}
      disabled={loading}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        subscribed
          ? 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100'
          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900'
      }`}
    >
      {subscribed ? 'Subscribed' : 'Subscribe'} • {count.toLocaleString()}
    </button>
  );
}
