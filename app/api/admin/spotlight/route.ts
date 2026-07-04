import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { sendNotification } from '@/lib/notifications';
import { nextMonday1amPst } from '@/lib/spotlight';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    video_id?: string;
    publish_now?: boolean;
  };
  const videoId = body.video_id;
  const publishNow = Boolean(body.publish_now);

  if (!videoId) {
    return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
  }

  const { data: video } = await supabase
    .from('videos')
    .select('id,user_id,title')
    .eq('id', videoId)
    .eq('visibility', 'public')
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const scheduledFor = publishNow ? new Date() : nextMonday1amPst();

  const basePayload = {
    video_id: videoId,
    scheduled_for: scheduledFor.toISOString(),
    created_by: user.id,
  };

  const query = publishNow
    ? supabase.from('creator_spotlights').insert(basePayload)
    : supabase.from('creator_spotlights').upsert(basePayload, { onConflict: 'scheduled_for' });

  const { data, error } = await query.select('id,scheduled_for').single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const publishLabel = publishNow
    ? 'Your video was selected for Creator Spotlight and is now live.'
    : `Your video was selected for Creator Spotlight (${new Date(data.scheduled_for).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT).`;
  await sendNotification(supabase, {
    userId: video.user_id,
    type: 'creator_spotlight',
    message: publishLabel,
    actorId: user.id,
    targetUrl: `/watch/${video.id}`,
  });

  return NextResponse.json({
    id: data.id,
    scheduled_for: data.scheduled_for,
    publish_now: publishNow,
  });
}
