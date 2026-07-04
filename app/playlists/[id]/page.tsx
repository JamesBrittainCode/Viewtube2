import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VideoGrid } from '@/components/video-grid';

export const runtime = 'edge';

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlistId = String(id || '').trim();
  if (!playlistId) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: playlist } = await supabase
    .from('playlists')
    .select('id,user_id,title,description,is_public,is_watch_later')
    .eq('id', playlistId)
    .maybeSingle();

  if (!playlist) notFound();
  if (playlist.is_watch_later) redirect('/watch-later');

  const isOwner = user?.id && playlist.user_id === user.id;
  if (!playlist.is_public && !isOwner) {
    if (!user) redirect('/sign-in');
    notFound();
  }

  const { data: items } = await supabase
    .from('playlist_items')
    .select(
      `
        id,
        created_at,
        video:videos(
          id,title,thumbnail_url,duration_seconds,is_short,views,created_at,visibility,
          profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified,is_admin,top_streamer,streak_champion)
        )
      `,
    )
    .eq('playlist_id', playlistId)
    .order('created_at', { ascending: false });

  const videos = (items || [])
    .map((row) => (row as unknown as { video?: Record<string, unknown> | null }).video)
    .filter((video) => Boolean(video) && (isOwner || video?.visibility === 'public'));

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{playlist.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {playlist.is_public ? 'Public playlist' : 'Private playlist'}
        </p>
        {playlist.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
            {playlist.description}
          </p>
        ) : null}
      </div>

      <VideoGrid videos={videos as never[]} />
    </section>
  );
}
