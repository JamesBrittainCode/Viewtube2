'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Activity, Eye, Heart, MessageCircle, Radio, Users, Video } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { formatCompactCount } from '@/lib/number';
import { displayHandle } from '@/lib/handle';
import { unwrapRelation } from '@/lib/profile';

type DashboardPayload = {
  profile: { username?: string | null; handle?: string | null; subscribers_count?: number | null } | null;
  metrics: {
    subscribers: number;
    videos: number;
    shorts: number;
    publicVideos: number;
    totalViews: number;
    recentViews: number;
    comments: number;
    recentComments: number;
    likes: number;
  };
  topVideos: Array<{ id: string; title: string; thumbnail_url?: string | null; views?: number | null }>;
  recentComments: Array<{
    id: string;
    content: string;
    created_at: string;
    video_id: string;
    profiles?: { username?: string | null; handle?: string | null; avatar_url?: string | null } | Array<{ username?: string | null; handle?: string | null; avatar_url?: string | null }> | null;
  }>;
  updatedAt: string;
};

function MetricCard({
  label,
  value,
  hint,
  icon,
  pulse,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  pulse?: boolean;
}) {
  return (
    <div className={['rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition', pulse ? 'ring-2 ring-red-500/40' : ''].join(' ')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <div className="rounded-full bg-red-500/10 p-2 text-red-400">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">{formatCompactCount(value)}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export function StudioLiveDashboard({
  initialData,
  userId,
}: {
  initialData: DashboardPayload;
  userId: string;
}) {
  const [data, setData] = useState(initialData);
  const [livePulse, setLivePulse] = useState(false);
  const previousTotalsRef = useRef(initialData.metrics);

  const changedMetrics = useMemo(() => {
    const prev = previousTotalsRef.current;
    return {
      subscribers: data.metrics.subscribers !== prev.subscribers,
      totalViews: data.metrics.totalViews !== prev.totalViews,
      comments: data.metrics.comments !== prev.comments,
      likes: data.metrics.likes !== prev.likes,
    };
  }, [data.metrics]);

  async function refresh() {
    const res = await fetch('/api/studio/dashboard', { cache: 'no-store' });
    if (!res.ok) return;
    const next = (await res.json()) as DashboardPayload;
    previousTotalsRef.current = data.metrics;
    setData(next);
    setLivePulse(true);
    window.setTimeout(() => setLivePulse(false), 900);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`studio-dashboard-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos', filter: `user_id=eq.${userId}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `creator_id=eq.${userId}` }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => void refresh())
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 20000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Live channel pulse</h2>
          <p className="text-sm text-zinc-500">
            {data.profile?.username || 'Creator'} {displayHandle(data.profile?.handle)} • Updated{' '}
            {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200">
          <span className={['h-2.5 w-2.5 rounded-full', livePulse ? 'bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.9)]' : 'bg-emerald-400'].join(' ')} />
          Live
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Subscribers" value={data.metrics.subscribers} hint="Current channel audience" icon={<Users className="h-4 w-4" />} pulse={changedMetrics.subscribers} />
        <MetricCard label="Total views" value={data.metrics.totalViews} hint={`${formatCompactCount(data.metrics.recentViews)} from recent uploads`} icon={<Eye className="h-4 w-4" />} pulse={changedMetrics.totalViews} />
        <MetricCard label="Comments" value={data.metrics.comments} hint={`${formatCompactCount(data.metrics.recentComments)} in the last 48h`} icon={<MessageCircle className="h-4 w-4" />} pulse={changedMetrics.comments} />
        <MetricCard label="Likes" value={data.metrics.likes} hint={`${data.metrics.videos} videos • ${data.metrics.shorts} shorts`} icon={<Heart className="h-4 w-4" />} pulse={changedMetrics.likes} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Top content right now</h3>
            <Activity className="h-5 w-5 text-red-400" />
          </div>
          <div className="mt-4 grid gap-3">
            {data.topVideos.map((video, index) => (
              <Link key={video.id} href={`/watch/${video.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-black text-zinc-300">#{index + 1}</div>
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-900">
                  <Image src={video.thumbnail_url || '/thumbnail-placeholder.svg'} alt="" fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{video.title}</p>
                  <p className="text-xs text-zinc-500">{formatCompactCount(Number(video.views || 0))} views</p>
                </div>
              </Link>
            ))}
            {!data.topVideos.length ? <p className="text-sm text-zinc-500">Upload a video to start seeing rankings.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Recent comments</h3>
            <Radio className="h-5 w-5 text-red-400" />
          </div>
          <div className="mt-4 space-y-3">
            {data.recentComments.map((comment) => {
              const profile = unwrapRelation(comment.profiles);
              return (
                <Link key={comment.id} href={`/watch/${comment.video_id}`} className="block rounded-2xl border border-zinc-900 bg-white/[0.03] p-3 hover:bg-white/[0.06]">
                  <p className="line-clamp-2 text-sm text-zinc-200">“{comment.content}”</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {profile?.username || 'Viewer'} • {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </p>
                </Link>
              );
            })}
            {!data.recentComments.length ? <p className="text-sm text-zinc-500">New comments will show here as they land.</p> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300 sm:grid-cols-3">
        <div className="flex items-center gap-2"><Video className="h-4 w-4 text-zinc-500" /> {data.metrics.publicVideos} public videos</div>
        <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-zinc-500" /> Comment velocity: {formatCompactCount(data.metrics.recentComments)} / 48h</div>
        <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-zinc-500" /> Recent upload views: {formatCompactCount(data.metrics.recentViews)}</div>
      </div>
    </div>
  );
}
