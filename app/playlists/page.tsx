import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlaylistCard, type PlaylistCardData } from '@/components/playlist-card';

export const runtime = 'edge';

type PlaylistRow = {
  id: string;
  title: string;
  is_public: boolean;
  is_watch_later: boolean;
  updated_at: string;
};

export default async function PlaylistsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: playlists } = await supabase
    .from('playlists')
    .select('id,title,is_public,is_watch_later,updated_at')
    .eq('user_id', user.id)
    .order('is_watch_later', { ascending: false })
    .order('updated_at', { ascending: false });

  const list = (playlists || []) as PlaylistRow[];
  const watchLater = list.find((p) => p.is_watch_later);
  const others = list.filter((p) => !p.is_watch_later);

  const playlistIds = others.map((p) => p.id);
  const { data: items } = playlistIds.length
    ? await supabase
        .from('playlist_items')
        .select('playlist_id,created_at,video:videos(thumbnail_url)')
        .in('playlist_id', playlistIds)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] as unknown[] };

  const countByPlaylist = new Map<string, number>();
  const coverByPlaylist = new Map<string, string | null>();

  (items || []).forEach((row) => {
    const playlistId = String((row as { playlist_id?: unknown }).playlist_id || '');
    if (!playlistId) return;
    countByPlaylist.set(playlistId, (countByPlaylist.get(playlistId) || 0) + 1);
    if (!coverByPlaylist.has(playlistId)) {
      const videoRelation = (
        row as unknown as {
          video?: { thumbnail_url?: string | null }[] | { thumbnail_url?: string | null } | null;
        }
      ).video;
      const url = Array.isArray(videoRelation)
        ? videoRelation[0]?.thumbnail_url ?? null
        : videoRelation?.thumbnail_url ?? null;
      coverByPlaylist.set(playlistId, url);
    }
  });

  const cards: PlaylistCardData[] = others.map((p) => ({
    id: p.id,
    title: p.title,
    is_public: p.is_public,
    updated_at: p.updated_at,
    videoCount: countByPlaylist.get(p.id) || 0,
    coverThumbnailUrl: coverByPlaylist.get(p.id) ?? null,
  }));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Playlists</h1>
          <p className="mt-2 text-sm text-zinc-500">Your playlists and saved videos.</p>
        </div>
        {watchLater ? (
          <Link
            href="/watch-later"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Watch later
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          Recently added ▾
        </button>
        <span className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
          Playlists
        </span>
        <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Owned
        </span>
        <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Saved
        </span>
      </div>

      {cards.length ? (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          No playlists yet. Click “Save” on any video to create one.
        </div>
      )}
    </section>
  );
}
