import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VideoGrid } from '@/components/video-grid';

export const runtime = 'edge';

export default async function WatchLaterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  // Ensure Watch Later exists.
  const { data: existing } = await supabase
    .from('playlists')
    .select('id,title')
    .eq('user_id', user.id)
    .eq('is_watch_later', true)
    .maybeSingle();

  if (!existing) {
    await supabase.from('playlists').insert({
      user_id: user.id,
      title: 'Watch later',
      is_public: false,
      is_watch_later: true,
    });
  }

  const { data: watchLater } = await supabase
    .from('playlists')
    .select('id,title')
    .eq('user_id', user.id)
    .eq('is_watch_later', true)
    .maybeSingle();

  if (!watchLater) redirect('/playlists');

  const { data: items } = await supabase
    .from('playlist_items')
    .select(
      `
        id,
        created_at,
        video:videos(
          id,title,thumbnail_url,duration_seconds,is_short,views,created_at,
          profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified,is_admin,top_streamer,streak_champion)
        )
      `,
    )
    .eq('playlist_id', watchLater.id)
    .order('created_at', { ascending: false });

  const videos = (items || [])
    .map((row) => (row as unknown as { video?: Record<string, unknown> | null }).video)
    .filter(Boolean);

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Watch later</h1>
        <p className="mt-1 text-sm text-zinc-500">Private playlist</p>
      </div>
      <VideoGrid videos={videos as never[]} />
    </section>
  );
}
