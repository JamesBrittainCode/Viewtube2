import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  if (existing) {
    await supabase.from('subscriptions').delete().eq('id', existing.id);
    subscribed = false;
  } else {
    await supabase
      .from('subscriptions')
      .insert({ subscriber_id: user.id, creator_id: creatorId });
    subscribed = true;

    await supabase.from('notifications').insert({
      user_id: creatorId,
      actor_id: user.id,
      type: 'new_subscriber',
      message: 'You have a new subscriber',
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
  });
}
