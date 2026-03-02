import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
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
  profiles?: StudioChannel | StudioChannel[] | null;
};

export default async function StudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const isAdmin = isAdminEmail(user.email);
  const nowIso = new Date().toISOString();

  const [profileRes, videosRes, currentRes, nextRes] = await Promise.all([
    supabase.from('profiles').select('username,handle,subscribers_count').eq('id', user.id).single(),
    supabase
      .from('videos')
      .select('id,views')
      .eq('user_id', user.id),
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
  ]);

  const profile = profileRes.data;
  const videos = videosRes.data || [];
  const totalViews = videos.reduce((sum, video) => sum + (video.views || 0), 0);
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

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="border-r border-zinc-200 bg-zinc-950 px-4 py-6 text-zinc-100 dark:border-zinc-800">
        <h1 className="text-xl font-bold">ViewTube Studio</h1>
        <nav className="mt-6 space-y-2 text-sm">
          <a href="#dashboard" className="block rounded-lg bg-zinc-800 px-3 py-2">Dashboard</a>
          <a href="#spotlight" className="block rounded-lg px-3 py-2 hover:bg-zinc-800">Creator Spotlight</a>
          {isAdmin && (
            <a href="#admin-controls" className="block rounded-lg px-3 py-2 hover:bg-zinc-800">Admin Controls</a>
          )}
          <Link href="/" className="mt-4 block rounded-lg px-3 py-2 hover:bg-zinc-800">Back to ViewTube</Link>
        </nav>
      </aside>

      <main className="bg-zinc-100 p-6 dark:bg-zinc-950" id="dashboard">
        <div className="mx-auto max-w-6xl space-y-6">
          <header>
            <h2 className="text-2xl font-bold">Welcome, {profile?.username || 'Creator'}</h2>
            <p className="text-sm text-zinc-500">{profile?.handle || '@user'} • Your creator workspace</p>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Subscribers</p>
              <p className="mt-2 text-2xl font-bold">{formatCompactCount(profile?.subscribers_count || 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Videos</p>
              <p className="mt-2 text-2xl font-bold">{videos.length.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">Total Views</p>
              <p className="mt-2 text-2xl font-bold">{formatCompactCount(totalViews)}</p>
            </div>
          </section>

          <section id="spotlight" className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">Creator Spotlight</h3>
            <p className="mt-1 text-sm text-zinc-500">Weekly feature video. New picks publish Monday at 1:00 AM PST.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h4 className="text-sm font-semibold text-zinc-500">Live now</h4>
                {currentRes.data && currentVideo?.id ? (
                  <Link href={`/watch/${currentVideo.id}`} className="mt-3 block">
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
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

              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h4 className="text-sm font-semibold text-zinc-500">Next up</h4>
                {nextRes.data && nextVideo?.id ? (
                  <Link href={`/watch/${nextVideo.id}`} className="mt-3 block">
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
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

          {isAdmin && (
            <section id="admin-controls">
              <AdminProfileManager />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
