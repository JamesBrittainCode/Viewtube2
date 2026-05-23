import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('live_streams')
    .select('id,user_id,title,description,thumbnail_url,source,ingest_stream_name,is_live,viewer_count,started_at,profiles:profiles!live_streams_user_id_fkey(username,handle,avatar_url,verified,top_streamer)')
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ streams: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,can_stream_live')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!profile.can_stream_live) {
    return NextResponse.json(
      { error: 'Live streaming is not enabled for this account.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { title?: string; description?: string };
  const title = String(body.title || 'Live Stream').trim().slice(0, 120) || 'Live Stream';
  const description = String(body.description || '').trim().slice(0, 1000);

  const { data: existing } = await supabase
    .from('live_streams')
    .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at')
    .eq('user_id', user.id)
    .eq('is_live', true)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ stream: existing });
  }

  const { data, error } = await supabase
    .from('live_streams')
    .insert({
      user_id: user.id,
      title,
      description,
      is_live: true,
      viewer_count: 0,
    })
    .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await recordViewtubeActivity(supabase, 'go_live');
  return NextResponse.json({ stream: data });
}
