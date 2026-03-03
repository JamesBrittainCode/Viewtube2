import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatCompactCount } from '@/lib/number';
import { buildMonthlySeries } from '@/lib/studio-analytics';
import { StudioChart } from '@/components/studio-chart';

export default async function StudioAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: videos } = await supabase
    .from('videos')
    .select('id,views,created_at')
    .eq('user_id', user.id);

  const list = videos || [];
  const totalViews = list.reduce((sum, video) => sum + (video.views || 0), 0);
  const avgViews = list.length ? Math.round(totalViews / list.length) : 0;
  const chart = buildMonthlySeries(
    list.map((video) => ({ created_at: video.created_at, views: video.views || 0 })),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-4xl font-bold">Analytics</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Total views</p>
          <p className="mt-2 text-3xl font-bold">{formatCompactCount(totalViews)}</p>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Average views per video</p>
          <p className="mt-2 text-3xl font-bold">{formatCompactCount(avgViews)}</p>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Published videos</p>
          <p className="mt-2 text-3xl font-bold">{list.length.toLocaleString()}</p>
        </div>
      </section>

      <StudioChart labels={chart.labels} values={chart.values} />
    </div>
  );
}
