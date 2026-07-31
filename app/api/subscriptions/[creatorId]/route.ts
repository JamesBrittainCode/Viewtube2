import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';

export const runtime = 'edge';

export async function POST(
  _request: Request,
  context: { params: Promise<{ creatorId: string }> },
) {
  const { creatorId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (creatorId === user.id) {
    return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', user.id)
    .eq('creator_id', creatorId)
    .maybeSingle();

  let subscribed = false;
  let streak: unknown = null;

  if (existing) {
    await supabase.from('subscriptions').delete().eq('id', existing.id);
    subscribed = false;
  } else {
    const { error: insertError } = await supabase
      .from('subscriptions')
      .insert({ subscriber_id: user.id, creator_id: creatorId });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
    subscribed = true;

    // Award points only once per user+creator.
    const { error: awardErr } = await supabase.from('viewtube_activity_awards').insert({
      user_id: user.id,
      activity_type: 'subscribe',
      target_id: creatorId,
    });
    const pointsOk = !awardErr;
    streak = await recordViewtubeActivity(supabase, 'subscribe', { targetId: creatorId, pointsOk });

    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .maybeSingle();

    await sendNotification(supabase, {
      userId: creatorId,
      type: 'new_subscriber',
      message: 'You have a new subscriber',
      actorId: user.id,
      targetUrl: actorProfile?.handle ? `/channel/${actorProfile.handle}` : null,
      pushTitle: 'You got a new subscriber',
      pushBody: actorProfile?.handle ? `@${actorProfile.handle} subscribed to you.` : 'Someone subscribed to you.',
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscribers_count')
    .eq('id', creatorId)
    .single();

  return NextResponse.json({
    subscribed,
    count: profile?.subscribers_count || 0,
    streak,
  });
}
