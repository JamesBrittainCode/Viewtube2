import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('comments')
    .select('id,video_id,user_id,parent_id,content,pinned,created_at,profiles:profiles!comments_user_id_fkey(username,handle,avatar_url,verified)')
    .eq('video_id', id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const comments = data || [];
  const commentIds = comments.map((item) => item.id);
  let likeRows: { comment_id: string; user_id: string }[] = [];

  if (commentIds.length) {
    const { data: likesData } = await supabase
      .from('comment_likes')
      .select('comment_id,user_id')
      .in('comment_id', commentIds);
    likeRows = likesData || [];
  }

  const likeCountByComment = new Map<string, number>();
  const likedSet = new Set<string>();

  likeRows.forEach((row) => {
    likeCountByComment.set(row.comment_id, (likeCountByComment.get(row.comment_id) || 0) + 1);
    if (user && row.user_id === user.id) likedSet.add(row.comment_id);
  });

  const enriched = comments.map((item) => ({
    ...item,
    likes_count: likeCountByComment.get(item.id) || 0,
    liked_by_me: likedSet.has(item.id),
  }));

  return NextResponse.json({ comments: enriched });
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
    .select('id,user_id,comments_enabled')
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

  if (video.user_id !== user.id) {
    await sendNotification(supabase, {
      userId: video.user_id,
      type: 'new_comment',
      message: 'Someone commented on your video',
      actorId: user.id,
      targetUrl: `/watch/${id}#comments`,
    });
  }

  return NextResponse.json({ ok: true });
}

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

  const body = (await request.json()) as { commentId?: string; pinned?: boolean };
  const commentId = String(body.commentId || '').trim();
  if (!commentId || typeof body.pinned !== 'boolean') {
    return NextResponse.json({ error: 'commentId and pinned are required' }, { status: 400 });
  }

  const [{ data: video }, { data: comment }] = await Promise.all([
    supabase.from('videos').select('id,user_id').eq('id', id).maybeSingle(),
    supabase
      .from('comments')
      .select('id,parent_id,video_id')
      .eq('id', commentId)
      .eq('video_id', id)
      .maybeSingle(),
  ]);

  if (!video || !comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the video creator can pin comments' }, { status: 403 });
  }
  if (comment.parent_id) {
    return NextResponse.json({ error: 'Only top-level comments can be pinned' }, { status: 400 });
  }

  const { error } = await supabase
    .from('comments')
    .update({ pinned: body.pinned })
    .eq('id', commentId)
    .eq('video_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, pinned: body.pinned });
}

export async function DELETE(
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

  const body = (await request.json()) as { commentId?: string };
  const commentId = String(body.commentId || '').trim();
  if (!commentId) {
    return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
  }

  const [{ data: video }, { data: comment }] = await Promise.all([
    supabase.from('videos').select('id,user_id').eq('id', id).maybeSingle(),
    supabase
      .from('comments')
      .select('id,user_id,video_id')
      .eq('id', commentId)
      .eq('video_id', id)
      .maybeSingle(),
  ]);

  if (!video || !comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  const canDelete = comment.user_id === user.id || video.user_id === user.id;
  if (!canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('video_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
