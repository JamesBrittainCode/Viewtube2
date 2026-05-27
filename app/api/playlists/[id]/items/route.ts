import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const playlistId = String(id || '').trim();
  if (!playlistId) return NextResponse.json({ error: 'Invalid playlist id' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { videoId?: string };
  const videoId = String(body.videoId || '').trim();
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 });

  const { error } = await supabase.from('playlist_items').insert({
    playlist_id: playlistId,
    video_id: videoId,
  });

  if (error) {
    // Unique constraint → already saved; treat as ok.
    if (String(error.code) === '23505') return NextResponse.json({ ok: true, alreadySaved: true });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const playlistId = String(id || '').trim();
  if (!playlistId) return NextResponse.json({ error: 'Invalid playlist id' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { videoId?: string };
  const videoId = String(body.videoId || '').trim();
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 });

  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('video_id', videoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

