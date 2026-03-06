import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    .from('dislikes')
    .select('id')
    .eq('video_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let disliked = false;

  if (existing) {
    await supabase.from('dislikes').delete().eq('id', existing.id);
    disliked = false;
  } else {
    await supabase.from('likes').delete().eq('video_id', id).eq('user_id', user.id);
    await supabase.from('dislikes').insert({ video_id: id, user_id: user.id });
    disliked = true;
  }

  const { count } = await supabase
    .from('dislikes')
    .select('*', { count: 'exact', head: true })
    .eq('video_id', id);

  return NextResponse.json({ disliked, count: count || 0 });
}
