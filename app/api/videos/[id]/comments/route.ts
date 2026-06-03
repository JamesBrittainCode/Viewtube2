import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { canModerateUser } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';
import { checkContestActivityGate, normalizeContestText } from '@/lib/contest-abuse';

export const runtime = 'edge';

function minutesFromNow(mins: number) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

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
    .select(
      'id,video_id,user_id,parent_id,content,pinned,created_at,profiles:profiles!comments_user_id_fkey(username,handle,avatar_url,verified,top_streamer,streak_champion)',
    )
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

  const { data: me } = await supabase
    .from('profiles')
    .select('id,comment_suspended_until,comment_spam_strikes,can_moderate')
    .eq('id', user.id)
    .maybeSingle();

  const suspendedUntil = me?.comment_suspended_until ? new Date(me.comment_suspended_until).getTime() : 0;
  if (suspendedUntil && Date.now() < suspendedUntil) {
    const secondsLeft = Math.max(1, Math.ceil((suspendedUntil - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: `You’re temporarily suspended from commenting for ${Math.ceil(secondsLeft / 60)} minute(s).`,
        code: 'comment_suspended',
        seconds_left: secondsLeft,
      },
      { status: 429 },
    );
  }

  const body = (await request.json()) as { parentId: string | null; content: string };
  const content = body.content?.trim();
  const contentKey = content ? normalizeContestText(content) : '';

  if (!content) {
    return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
  }

  const contestGate = await checkContestActivityGate(supabase, 'comment', { contentKey });
  if (!contestGate.allowed) {
    return NextResponse.json(
      {
        error: contestGate.message || 'Your contest points are temporarily paused for spammy activity.',
        code: contestGate.status,
        strikes: contestGate.strikes,
        paused_until: contestGate.pausedUntil,
      },
      { status: 429 },
    );
  }

  // Balanced anti-spam: catches bursts and repeated text, while leaving normal conversation alone.
  const windowSeconds = 90;
  const limit = 8;
  const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', sinceIso);

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentComments } = await supabase
    .from('comments')
    .select('content')
    .eq('user_id', user.id)
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  const repeatedCount = (recentComments || []).filter((item) => normalizeContestText(String(item.content || '')) === contentKey)
    .length;

  const wouldExceed = (recentCount || 0) >= limit || (contentKey.length >= 8 && repeatedCount >= 4);
  if (wouldExceed) {
    const newStrikes = (me?.comment_spam_strikes || 0) + 1;
    const until = minutesFromNow(20);
    const contestStrike = await checkContestActivityGate(supabase, 'comment', {
      contentKey,
      forceStrikeReason: 'Contest points paused for comment spam.',
    });

    await supabase
      .from('profiles')
      .update({
        comment_suspended_until: until,
        comment_spam_strikes: newStrikes,
      })
      .eq('id', user.id);

    await sendNotification(supabase, {
      userId: user.id,
      type: 'comment_suspension',
      message:
        newStrikes >= 2
          ? 'You have been temporarily suspended from commenting for 20 minutes due to spam. This incident has been reported to moderators.'
          : 'You have been temporarily suspended from commenting for 20 minutes due to spam. You may also receive a contest strike if this affects points.',
      targetUrl: `/watch/${id}#comments`,
    });

    if (newStrikes >= 2) {
      // Notify moderators/admins.
      const { data: mods } = await supabase
        .from('profiles')
        .select('id')
        .eq('can_moderate', true)
        .limit(50);
      for (const mod of mods || []) {
        if (!mod?.id) continue;
        await sendNotification(supabase, {
          userId: mod.id,
          type: 'comment_spam_report',
          message: 'A user was auto-suspended for comment spam (repeat offense).',
          actorId: user.id,
          targetUrl: `/watch/${id}#comments`,
        });
      }
    }

    return NextResponse.json(
      {
        error:
          newStrikes >= 2
            ? 'You’re temporarily suspended from commenting for 20 minutes due to spam. This was reported to moderators.'
            : contestStrike.message || 'You’re temporarily suspended from commenting for 20 minutes due to spam.',
        code: 'comment_suspended',
        seconds_left: 20 * 60,
        contest_strikes: contestStrike.strikes,
        contest_status: contestStrike.status,
      },
      { status: 429 },
    );
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

  const { error } = await supabase.from('comments').insert({
    video_id: id,
    user_id: user.id,
    parent_id: body.parentId || null,
    content,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const streak = await recordViewtubeActivity(supabase, 'comment', { contentKey });

  if (video.user_id !== user.id) {
    await sendNotification(supabase, {
      userId: video.user_id,
      type: 'new_comment',
      message: 'Someone commented on your video',
      actorId: user.id,
      targetUrl: `/watch/${id}#comments`,
    });
  }

  return NextResponse.json({ ok: true, streak });
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

  const canModerate = await canModerateUser(supabase, { id: user.id, email: user.email });
  const canDelete = comment.user_id === user.id || video.user_id === user.id || canModerate;
  if (!canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('video_id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
