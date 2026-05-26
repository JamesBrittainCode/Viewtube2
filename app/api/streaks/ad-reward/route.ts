import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';

export const runtime = 'edge';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // One reward per UTC day (matches streak day logic).
  const todayUtc = new Date().toISOString().slice(0, 10);

  const { error: awardErr } = await supabase.from('viewtube_activity_awards').insert({
    user_id: user.id,
    activity_type: 'ad_watch',
    target_id: todayUtc,
  });

  const pointsOk = !awardErr;
  const streak = await recordViewtubeActivity(supabase, 'ad_watch', { targetId: todayUtc, pointsOk });

  return NextResponse.json({
    ok: true,
    claimed: pointsOk,
    streak,
  });
}

