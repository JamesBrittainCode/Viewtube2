import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CircleHelp,
  Clapperboard,
  Compass,
  MessageSquareMore,
  Search,
  Settings,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { formatCompactCount } from '@/lib/number';
import { unwrapRelation } from '@/lib/profile';

type StudioChannel = { username?: string; handle?: string };
type StudioVideo = {
  id?: string;
  title?: string;
  thumbnail_url?: string | null;
  views?: number;
  created_at?: string;
  profiles?: StudioChannel | StudioChannel[] | null;
};

function buildMonthlySeries(videos: Array<{ created_at: string; views: number }>) {
  const now = new Date();
  const labels: string[] = [];
  const values: number[] = [];

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    labels.push(
      d.toLocaleString('en-US', {
        month: 'short',
      }),
    );

    const monthValue = videos.reduce((sum, video) => {
      const vd = new Date(video.created_at);
      if (vd.getFullYear() === year && vd.getMonth() === month) {
        return sum + (video.views || 0);
      }
      return sum;
    }, 0);

    values.push(monthValue);
  }

  return { labels, values };
}

function StudioChart({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-100">Views Trend (last 12 months)</h4>
        <span className="text-xs text-zinc-400">Estimated from uploaded video totals</span>
      </div>

      <div className="flex h-40 items-end gap-2">
        {values.map((value, idx) => {
          const height = Math.max(8, Math.round((value / max) * 140));
          return (
            <div key={`${labels[idx]}-${idx}`} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-red-600 to-red-400 transition-all duration-300 group-hover:from-red-500 group-hover:to-red-300"
                style={{ height: `${height}px` }}
                title={`${labels[idx]}: ${value.toLocaleString()} views`}
              />
              <span className="text-[10px] text-zinc-500">{labels[idx]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function StudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const isAdmin = isAdminEmail(user.email);
  const nowIso = new Date().toISOString();

  const [profileRes, videosRes, currentRes, nextRes, latestVideoRes, topVideosRes] = await Promise.all([
    supabase.from('profiles').select('username,handle,avatar_url,subscribers_count').eq('id', user.id).single(),
    supabase.from('videos').select('id,views,created_at,title,thumbnail_url').eq('user_id', user.id),
    supabase
      .from('creator_spotlights')
      .select(
        'id,scheduled_for,videos:videos(id,title,thumbnail_url,profiles:profiles!videos_user_id_fkey(username,handle))',
      )
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('creator_spotlights')
      .select(
        'id,scheduled_for,videos:videos(id,title,thumbnail_url,profiles:profiles!videos_user_id_fkey(username,handle))',
      )
      .gt('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .maybeSingle(),
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
    videos.map((video) => ({
      created_at: video.created_at,
      views: video.views || 0,
    })),
  );

  const currentVideo = unwrapRelation(
    ((currentRes.data as unknown as { videos?: StudioVideo | StudioVideo[] | null } | null)?.videos ??
      null) as StudioVideo | StudioVideo[] | null,
  );
  const nextVideo = unwrapRelation(
    ((nextRes.data as unknown as { videos?: StudioVideo | StudioVideo[] | null } | null)?.videos ??
      null) as StudioVideo | StudioVideo[] | null,
  );
  const currentChannel = unwrapRelation(currentVideo?.profiles ?? null);
  const nextChannel = unwrapRelation(nextVideo?.profiles ?? null);

  const studioNews = [
    'Creator Spotlight now supports weekly scheduling from watch pages.',
    'Channel handles are now used in URLs for exact creator linking.',
    'Studio dashboard now shows trend and top content performance.',
  ];

  return (
    <div className="min-h-screen bg-[#202124] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#202124]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1700px] items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span className="rounded-md bg-red-600 px-2 py-1 text-white">View</span>
            <span>Tube</span>
            <span className="text-zinc-400">Studio</span>
          </Link>

          <div className="mx-auto hidden w-full max-w-2xl items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 md:flex">
            <Search className="h-4 w-4 text-zinc-500" />
            <span className="text-sm text-zinc-500">Search across your channel</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="rounded-full p-2 hover:bg-zinc-800"><MessageSquareMore className="h-5 w-5" /></button>
            <button className="rounded-full p-2 hover:bg-zinc-800"><CircleHelp className="h-5 w-5" /></button>
            <button className="rounded-full p-2 hover:bg-zinc-800"><Bell className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-zinc-800 bg-[#1b1c1d] p-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <Image
              src={profile?.avatar_url || '/avatar-placeholder.svg'}
              alt={profile?.username || 'Channel'}
              width={96}
              height={96}
              className="mx-auto h-24 w-24 rounded-full object-cover"
            />
            <p className="mt-3 text-sm text-zinc-400">Your channel</p>
            <p className="font-semibold">{profile?.username || 'Creator'}</p>
            <p className="text-sm text-zinc-500">{profile?.handle || '@user'}</p>
          </div>

          <nav className="mt-4 space-y-1 text-sm">
            <a href="#dashboard" className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2"><Compass className="h-4 w-4" /> Dashboard</a>
            <a href="#analytics" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800"><BarChart3 className="h-4 w-4" /> Analytics</a>
            <a href="#content" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800"><Video className="h-4 w-4" /> Content</a>
            <a href="#spotlight" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800"><Sparkles className="h-4 w-4" /> Creator Spotlight</a>
            {isAdmin && <a href="#admin-controls" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800"><Users className="h-4 w-4" /> Admin Controls</a>}
            <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800"><Clapperboard className="h-4 w-4" /> Back to ViewTube</Link>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-zinc-800"><Settings className="h-4 w-4" /> Settings</button>
          </nav>
        </aside>

        <main className="p-6" id="dashboard">
          <div className="mx-auto max-w-7xl space-y-6">
            <h1 className="text-4xl font-bold tracking-tight">Channel Dashboard</h1>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" id="analytics">
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
                <p className="text-xs text-zinc-500">Latest upload</p>
                <p className="mt-2 line-clamp-2 text-lg font-semibold">{latestVideoRes.data?.title || 'No uploads yet'}</p>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <StudioChart labels={chartSeries.labels} values={chartSeries.values} />
              </div>
              <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                <h3 className="text-lg font-semibold">Top content</h3>
                <p className="text-sm text-zinc-500">Last lifetime • ranked by views</p>
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

            <section className="grid gap-4 xl:grid-cols-3" id="content">
              <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                <h3 className="text-lg font-semibold">Latest video performance</h3>
                {latestVideoRes.data ? (
                  <Link href={`/watch/${latestVideoRes.data.id}`} className="mt-3 block">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-800">
                      <Image
                        src={latestVideoRes.data.thumbnail_url || '/thumbnail-placeholder.svg'}
                        alt={latestVideoRes.data.title || 'Latest video'}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="mt-3 line-clamp-2 text-base font-semibold">{latestVideoRes.data.title}</p>
                    <p className="text-sm text-zinc-400">
                      {formatCompactCount(latestVideoRes.data.views || 0)} views •{' '}
                      {formatDistanceToNow(new Date(latestVideoRes.data.created_at || nowIso), { addSuffix: true })}
                    </p>
                  </Link>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No uploads yet.</p>
                )}
              </div>

              <section id="spotlight" className="xl:col-span-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                <h3 className="text-lg font-semibold">Creator Spotlight</h3>
                <p className="mt-1 text-sm text-zinc-500">Weekly feature video. New picks publish Monday at 1:00 AM PST.</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-700 p-4">
                    <h4 className="text-sm font-semibold text-zinc-500">Live now</h4>
                    {currentRes.data && currentVideo?.id ? (
                      <Link href={`/watch/${currentVideo.id}`} className="mt-3 block">
                        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-800">
                          <Image
                            src={currentVideo.thumbnail_url || '/thumbnail-placeholder.svg'}
                            alt={currentVideo.title || 'Spotlight'}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold">{currentVideo.title}</p>
                        <p className="text-xs text-zinc-500">{currentChannel?.username}</p>
                      </Link>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-500">No spotlight video published yet.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-700 p-4">
                    <h4 className="text-sm font-semibold text-zinc-500">Next up</h4>
                    {nextRes.data && nextVideo?.id ? (
                      <Link href={`/watch/${nextVideo.id}`} className="mt-3 block">
                        <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-800">
                          <Image
                            src={nextVideo.thumbnail_url || '/thumbnail-placeholder.svg'}
                            alt={nextVideo.title || 'Next spotlight'}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold">{nextVideo.title}</p>
                        <p className="text-xs text-zinc-500">{nextChannel?.username}</p>
                        <p className="text-xs text-zinc-500">
                          Publishes: {new Date(nextRes.data.scheduled_for).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT
                        </p>
                      </Link>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-500">No next spotlight scheduled yet.</p>
                    )}
                  </div>
                </div>
              </section>
            </section>

            <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
              <h3 className="text-lg font-semibold">What’s new in Studio</h3>
              <ul className="mt-4 divide-y divide-zinc-800">
                {studioNews.map((item) => (
                  <li key={item} className="py-3 text-sm text-zinc-300">{item}</li>
                ))}
              </ul>
            </section>

            {isAdmin && (
              <section id="admin-controls">
                <AdminProfileManager />
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
