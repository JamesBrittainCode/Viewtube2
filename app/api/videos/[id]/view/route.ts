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

  const { error } = await supabase.rpc('increment_video_views', { video_id: id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (user?.id) {
    await supabase
      .from('viewtube_activity_awards')
      .insert({
        user_id: user.id,
        activity_type: 'watch_signal',
        target_id: id,
      })
      .select('id')
      .maybeSingle()
      .then(() => null);
  }

  return NextResponse.json({ ok: true });
}
