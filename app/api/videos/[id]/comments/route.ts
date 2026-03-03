import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('comments')
    .select('id,video_id,user_id,parent_id,content,created_at,profiles:profiles!comments_user_id_fkey(username,handle,avatar_url,verified)')
    .eq('video_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ comments: data || [] });
}

export async function POST(
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

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id,comments_enabled')
    .eq('id', id)
    .maybeSingle();

  if (videoError || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  if (!video.comments_enabled) {
    return NextResponse.json({ error: 'Comments are turned off for this video' }, { status: 403 });
  }

  const body = (await request.json()) as { parentId: string | null; content: string };
  const content = body.content?.trim();

  if (!content) {
    return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  }

  const { error } = await supabase.from('comments').insert({
    video_id: id,
    user_id: user.id,
    parent_id: body.parentId || null,
    content,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
