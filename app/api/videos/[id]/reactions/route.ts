import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [likesCountRes, dislikesCountRes, commentsCountRes, likedRes, dislikedRes] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('video_id', id),
    supabase.from('dislikes').select('*', { count: 'exact', head: true }).eq('video_id', id),
    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('video_id', id),
    user
      ? supabase.from('likes').select('id').eq('video_id', id).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('dislikes').select('id').eq('video_id', id).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    likes: likesCountRes.count || 0,
    dislikes: dislikesCountRes.count || 0,
    comments: commentsCountRes.count || 0,
    likedByMe: Boolean(likedRes?.data),
    dislikedByMe: Boolean(dislikedRes?.data),
  });
}

