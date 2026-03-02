import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
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

  const body = (await request.json()) as { video_id?: string };
  const videoId = body.video_id;

  if (!videoId) {
    return NextResponse.json({ error: 'video_id is required' }, { status: 400 });
  }

  const { data: video } = await supabase
    .from('videos')
    .select('id')
    .eq('id', videoId)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const scheduledFor = nextMonday1amPst();

  const { data, error } = await supabase
    .from('creator_spotlights')
    .upsert(
      {
        video_id: videoId,
        scheduled_for: scheduledFor.toISOString(),
        created_by: user.id,
      },
      { onConflict: 'scheduled_for' },
    )
    .select('id,scheduled_for')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    id: data.id,
    scheduled_for: data.scheduled_for,
  });
}
