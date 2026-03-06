import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

async function syncViewerCount(supabase: Awaited<ReturnType<typeof createClient>>, streamId: string) {
  const { count } = await supabase
    .from('live_stream_viewers')
    .select('*', { head: true, count: 'exact' })
    .eq('stream_id', streamId);

  await supabase
    .from('live_streams')
    .update({ viewer_count: count || 0 })
    .eq('id', streamId);

  return count || 0;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('live_streams')
    .select('id,user_id,title,description,is_live,viewer_count,started_at,ended_at,profiles:profiles!live_streams_user_id_fkey(username,handle,avatar_url,verified)')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  return NextResponse.json({ stream: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'join' | 'leave' | 'end';
    title?: string;
    description?: string;
  };
  const action = body.action || 'join';

  const { data: stream, error: streamError } = await supabase
    .from('live_streams')
    .select('id,user_id,is_live')
    .eq('id', id)
    .maybeSingle();
  if (streamError || !stream) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  if (action === 'join') {
    if (!stream.is_live) return NextResponse.json({ error: 'Stream is offline' }, { status: 400 });
    if (user.id !== stream.user_id) {
      await supabase.from('live_stream_viewers').upsert({ stream_id: id, user_id: user.id }, { onConflict: 'stream_id,user_id' });
      const count = await syncViewerCount(supabase, id);
      return NextResponse.json({ ok: true, viewer_count: count });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'leave') {
    await supabase.from('live_stream_viewers').delete().eq('stream_id', id).eq('user_id', user.id);
    const count = await syncViewerCount(supabase, id);
    return NextResponse.json({ ok: true, viewer_count: count });
  }

  if (action === 'end') {
    if (user.id !== stream.user_id) {
      return NextResponse.json({ error: 'Only the stream owner can end this stream' }, { status: 403 });
    }
    const updates = {
      is_live: false,
      ended_at: new Date().toISOString(),
      viewer_count: 0,
      title: typeof body.title === 'string' ? body.title.slice(0, 120) : undefined,
      description: typeof body.description === 'string' ? body.description.slice(0, 1000) : undefined,
    };
    const { error } = await supabase
      .from('live_streams')
      .update(updates)
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from('live_stream_viewers').delete().eq('stream_id', id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
