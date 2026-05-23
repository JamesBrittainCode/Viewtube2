import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';

export const runtime = 'edge';

export async function POST(
  _request: Request,
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

  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('video_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let liked = false;

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    await supabase.from('dislikes').delete().eq('video_id', id).eq('user_id', user.id);
    await supabase.from('likes').insert({ video_id: id, user_id: user.id });
    liked = true;
  }

  const streak = liked ? await recordViewtubeActivity(supabase, 'video_like') : null;

  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('video_id', id);

  return NextResponse.json({ liked, count: count || 0, streak });
}
