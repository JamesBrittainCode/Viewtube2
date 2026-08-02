import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('live_watch_parties')
    .select('id,creator_id,video_id,stream_id,title,description,scheduled_for,status,created_at,videos:videos(id,title,thumbnail_url,duration)')
    .eq('creator_id', user.id)
    .order('scheduled_for', { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ parties: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    video_id?: string;
    title?: string;
    description?: string;
    scheduled_for?: string;
  };
  const videoId = String(body.video_id || '').trim();
  const title = String(body.title || 'Watch party').trim().slice(0, 120);
  const description = String(body.description || '').trim().slice(0, 1000);
  const scheduledAt = new Date(String(body.scheduled_for || ''));

  if (!videoId) return NextResponse.json({ error: 'Choose a video for the watch party.' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Add a watch party title.' }, { status: 400 });
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Choose a date and time at least 5 minutes from now.' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const [{ data: profile }, { data: video }] = await Promise.all([
    adminClient.from('profiles').select('id,can_stream_live').eq('id', user.id).maybeSingle(),
    adminClient.from('videos').select('id,title').eq('id', videoId).maybeSingle(),
  ]);
  if (!profile?.can_stream_live) {
    return NextResponse.json({ error: 'Live streaming is not enabled for this account.' }, { status: 403 });
  }
  if (!video) return NextResponse.json({ error: 'Video not found.' }, { status: 404 });

  const { data, error } = await adminClient
    .from('live_watch_parties')
    .insert({
      creator_id: user.id,
      video_id: videoId,
      title,
      description,
      scheduled_for: scheduledAt.toISOString(),
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ party: data });
}
