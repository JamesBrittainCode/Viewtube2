import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const videoId = url.searchParams.get('videoId')?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ensure Watch Later exists.
  const { data: existingWatchLater } = await supabase
    .from('playlists')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_watch_later', true)
    .maybeSingle();

  if (!existingWatchLater) {
    await supabase.from('playlists').insert({
      user_id: user.id,
      title: 'Watch later',
      is_public: false,
      is_watch_later: true,
    });
  }

  const { data: playlists, error } = await supabase
    .from('playlists')
    .select('id,title,description,is_public,is_watch_later,created_at,updated_at')
    .eq('user_id', user.id)
    .order('is_watch_later', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = playlists || [];
  let savedPlaylistIds = new Set<string>();

  if (videoId && list.length) {
    const { data: rows } = await supabase
      .from('playlist_items')
      .select('playlist_id')
      .eq('video_id', videoId)
      .in(
        'playlist_id',
        list.map((p) => p.id),
      );
    savedPlaylistIds = new Set((rows || []).map((r) => String(r.playlist_id)));
  }

  return NextResponse.json({
    playlists: list.map((p) => ({
      ...p,
      containsVideo: videoId ? savedPlaylistIds.has(p.id) : undefined,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    isPublic?: boolean;
  };

  const title = String(body.title || '').trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('playlists')
    .insert({
      user_id: user.id,
      title,
      description: body.description ? String(body.description).trim() : null,
      is_public: readBoolean(body.isPublic),
      is_watch_later: false,
    })
    .select('id,title,description,is_public,is_watch_later,created_at,updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ playlist: data });
}

