import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

export async function PATCH(
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

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    isPublic?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if (typeof body.description === 'string') updates.description = body.description.trim();
  if (typeof body.isPublic !== 'undefined') updates.is_public = readBoolean(body.isPublic);

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('playlists')
    .update(updates)
    .eq('id', playlistId)
    .eq('user_id', user.id)
    .neq('is_watch_later', true)
    .select('id,title,description,is_public,is_watch_later,created_at,updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

  return NextResponse.json({ playlist: data });
}

export async function DELETE(
  _request: Request,
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

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', user.id)
    .neq('is_watch_later', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

