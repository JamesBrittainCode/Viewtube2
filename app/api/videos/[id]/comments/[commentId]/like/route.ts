import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';

export const runtime = 'edge';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; commentId: string }> },
) {
  const { id, commentId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: comment } = await supabase
    .from('comments')
    .select('id,video_id')
    .eq('id', commentId)
    .eq('video_id', id)
    .maybeSingle();

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .maybeSingle();

  let liked = false;

  if (existing) {
    await supabase.from('comment_likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });
    liked = true;
  }

  const streak = liked ? await recordViewtubeActivity(supabase, 'comment_like') : null;

  const { count } = await supabase
    .from('comment_likes')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', commentId);

  return NextResponse.json({ liked, count: count || 0, streak });
}
