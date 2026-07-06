import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VideoGrid } from '@/components/video-grid';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Library',
  description: 'Manage your ViewTube videos, playlists, and saved content.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: videos } = await supabase
    .from('videos')
    .select(
      'id,title,thumbnail_url,views,created_at,visibility,profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified,is_admin,top_streamer,streak_champion)'
    )
    .eq('user_id', user.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false });

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your library</h1>
        <Link
          href="/upload"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Upload new video
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/watch-later"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="text-sm font-semibold">Watch later</div>
          <div className="mt-1 text-sm text-zinc-500">Your private playlist</div>
        </Link>
        <Link
          href="/playlists"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="text-sm font-semibold">Playlists</div>
          <div className="mt-1 text-sm text-zinc-500">Public or private</div>
        </Link>
        <Link
          href="/playables"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="text-sm font-semibold">Playables</div>
          <div className="mt-1 text-sm text-zinc-500">Saved scores and levels</div>
        </Link>
      </div>

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Your uploads</h2>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
