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
  let streak: unknown = null;

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    await supabase.from('dislikes').delete().eq('video_id', id).eq('user_id', user.id);
    await supabase.from('likes').insert({ video_id: id, user_id: user.id });
    liked = true;
  }

  if (liked) {
    // Award points only once per user+video (prevents like/unlike/like farming).
    const { error: awardErr } = await supabase.from('viewtube_activity_awards').insert({
      user_id: user.id,
      activity_type: 'video_like',
      target_id: id,
    });
    const pointsOk = !awardErr;
    streak = await recordViewtubeActivity(supabase, 'video_like', { targetId: id, pointsOk });
  }

  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('video_id', id);

  return NextResponse.json({ liked, count: count || 0, streak });
}
