import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type PayloadPlaylist = {
  id: string;
  title: string;
  is_public: boolean;
  is_watch_later: boolean;
  updated_at: string;
  position: number;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('channel_featured_playlists')
    .select(
      `
        position,
        playlist:playlists!channel_featured_playlists_playlist_id_fkey(
          id,title,is_public,is_watch_later,updated_at
        )
      `,
    )
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const playlists: PayloadPlaylist[] = (data || [])
    .map((row) => {
      const p = (row as unknown as { playlist?: Record<string, unknown> | null }).playlist;
      if (!p) return null;
      return {
        id: String(p.id),
        title: String(p.title || 'Playlist'),
        is_public: Boolean(p.is_public),
        is_watch_later: Boolean(p.is_watch_later),
        updated_at: String(p.updated_at || ''),
        position: Number((row as { position?: unknown }).position || 0),
      };
    })
    .filter(Boolean) as PayloadPlaylist[];

  return NextResponse.json({ playlists });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { playlistIds?: unknown }
    | null;
  const idsRaw = body && 'playlistIds' in body ? (body.playlistIds as unknown) : [];
  const playlistIds = Array.isArray(idsRaw)
    ? idsRaw.map((id) => String(id || '').trim()).filter(Boolean)
    : [];

  if (playlistIds.length > 12) {
    return NextResponse.json({ error: 'Too many featured playlists (max 12).' }, { status: 400 });
  }

  // Ensure all playlists belong to user and are NOT watch later.
  if (playlistIds.length) {
    const { data: owned, error: ownedError } = await supabase
      .from('playlists')
      .select('id')
      .eq('user_id', user.id)
      .neq('is_watch_later', true)
      .in('id', playlistIds);
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 400 });
    const ownedSet = new Set((owned || []).map((p) => String((p as { id: string }).id)));
    const invalid = playlistIds.find((id) => !ownedSet.has(id));
    if (invalid) return NextResponse.json({ error: 'Invalid playlist selection.' }, { status: 400 });
  }

  // Replace all featured playlists atomically-ish: delete then insert.
  const { error: delError } = await supabase
    .from('channel_featured_playlists')
    .delete()
    .eq('user_id', user.id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });

  if (playlistIds.length) {
    const rows = playlistIds.map((playlistId, idx) => ({
      user_id: user.id,
      playlist_id: playlistId,
      position: idx,
    }));
    const { error: insError } = await supabase.from('channel_featured_playlists').insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

