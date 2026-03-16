'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OdometerNumber } from '@/components/odometer-number';
import { cn } from '@/lib/utils';

export function PetitionLiveCount({
  petitionKey,
  initialCount,
  className,
  showSuffix,
}: {
  petitionKey: string;
  initialCount: number;
  className?: string;
  showSuffix?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(() => Math.max(0, Math.floor(Number(initialCount) || 0)));

  useEffect(() => {
    setCount(Math.max(0, Math.floor(Number(initialCount) || 0)));
  }, [initialCount]);

  useEffect(() => {
    const channel = supabase
      .channel(`petition-votes:${petitionKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'petition_votes',
          filter: `petition_key=eq.${petitionKey}`,
        },
        () => setCount((c) => c + 1),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'petition_votes',
          filter: `petition_key=eq.${petitionKey}`,
        },
        () => setCount((c) => Math.max(0, c - 1)),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, petitionKey]);

  // Periodic re-sync in case the client missed realtime events.
  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      const { count: latest } = await supabase
        .from('petition_votes')
        .select('*', { count: 'exact', head: true })
        .eq('petition_key', petitionKey);
      if (!alive) return;
      if (typeof latest === 'number') setCount(latest);
    }, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [supabase, petitionKey]);

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <OdometerNumber value={count} className="font-semibold tracking-tight" />
      {showSuffix ? (
        <span className="text-xs opacity-90">
          {count === 1 ? 'vote' : 'votes'}
        </span>
      ) : null}
    </span>
  );
}

