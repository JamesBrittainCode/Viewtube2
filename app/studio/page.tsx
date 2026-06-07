import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { formatCompactCount } from '@/lib/number';
import { displayHandle } from '@/lib/handle';
import { buildMonthlySeries } from '@/lib/studio-analytics';
import { StudioChart } from '@/components/studio-chart';

export default async function StudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const [profileRes, videosRes, latestVideoRes, topVideosRes] = await Promise.all([
    supabase.from('profiles').select('username,handle,subscribers_count').eq('id', user.id).single(),
    supabase.from('videos').select('id,views,created_at,title,thumbnail_url').eq('user_id', user.id),
    supabase
      .from('videos')
      .select('id,title,thumbnail_url,views,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('videos')
      .select('id,title,views')
      .eq('user_id', user.id)
      .order('views', { ascending: false })
      .limit(5),
  ]);

  const profile = profileRes.data;
  const videos = videosRes.data || [];
  const totalViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);
  const chartSeries = buildMonthlySeries(
    videos.map((video) => ({ created_at: video.created_at, views: video.views || 0 })),
  );

  const studioNews = [
    'Creator Spotlight supports weekly scheduling from watch pages.',
    'Channel handles are now used in URLs for exact creator linking.',
    'More analytics modules are rolling out this month.',
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="text-4xl font-bold tracking-tight">Channel dashboard</h1>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Subscribers</p>
          <p className="mt-2 text-3xl font-bold">{formatCompactCount(profile?.subscribers_count || 0)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Videos</p>
          <p className="mt-2 text-3xl font-bold">{videos.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Total Views</p>
          <p className="mt-2 text-3xl font-bold">{formatCompactCount(totalViews)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500">Channel</p>
          <p className="mt-2 text-xl font-semibold">{profile?.username || 'Creator'}</p>
          <p className="text-sm text-zinc-500">{displayHandle(profile?.handle)}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <StudioChart labels={chartSeries.labels} values={chartSeries.values} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/studio/analytics" className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">Go to analytics</Link>
            <Link href="/studio/content" className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">Go to content</Link>
            <Link href="/studio/live" className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">Go live</Link>
            <Link href="/studio/spotlight" className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">Manage creator spotlight</Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-lg font-semibold">Top content</h3>
          <p className="text-sm text-zinc-500">Ranked by views</p>
          <div className="mt-4 space-y-3">
            {(topVideosRes.data || []).map((video) => (
              <Link key={video.id} href={`/watch/${video.id}`} className="flex items-start justify-between gap-3 rounded-lg px-2 py-1 hover:bg-zinc-800">
                <span className="line-clamp-1 text-sm">{video.title}</span>
                <span className="text-sm text-zinc-400">{formatCompactCount(video.views || 0)}</span>
              </Link>
            ))}
            {!(topVideosRes.data || []).length && <p className="text-sm text-zinc-500">No content yet.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-lg font-semibold">Latest video performance</h3>
          {latestVideoRes.data ? (
            <div className="mt-3 space-y-2">
              <Link href={`/watch/${latestVideoRes.data.id}`} className="line-clamp-2 text-base font-semibold hover:underline">
                {latestVideoRes.data.title}
              </Link>
              <p className="text-sm text-zinc-400">
                {formatCompactCount(latestVideoRes.data.views || 0)} views •{' '}
                {formatDistanceToNow(new Date(latestVideoRes.data.created_at), { addSuffix: true })}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No uploads yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-lg font-semibold">What’s new in Studio</h3>
          <ul className="mt-4 divide-y divide-zinc-800">
            {studioNews.map((item) => (
              <li key={item} className="py-3 text-sm text-zinc-300">{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
