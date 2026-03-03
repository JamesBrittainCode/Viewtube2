import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    comments_enabled?: boolean;
  };

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const commentsEnabled =
    typeof body.comments_enabled === 'boolean' ? body.comments_enabled : undefined;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id,user_id')
    .eq('id', id)
    .maybeSingle();

  if (videoError || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updates: {
    title: string;
    description: string;
    comments_enabled?: boolean;
  } = {
    title,
    description,
  };

  if (commentsEnabled !== undefined) {
    updates.comments_enabled = commentsEnabled;
  }

  const { error } = await supabase.from('videos').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
