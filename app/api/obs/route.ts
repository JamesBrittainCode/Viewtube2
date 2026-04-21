import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: profile }, { data: keyRow }, { data: cfgRow }] = await Promise.all([
    supabase.from('profiles').select('id,can_stream_live,suspended').eq('id', user.id).maybeSingle(),
    supabase.from('live_stream_keys').select('key_last4,created_at,rotated_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('live_stream_configs').select('title,description,thumbnail_url,updated_at').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.suspended) return NextResponse.json({ error: 'Account is suspended' }, { status: 403 });
  if (!profile.can_stream_live) return NextResponse.json({ error: 'Live streaming not enabled' }, { status: 403 });

  const rtmpUrl = process.env.NEXT_PUBLIC_RTMP_INGEST_URL || '';
  const hlsBase = process.env.NEXT_PUBLIC_HLS_BASE_URL || '';

  return NextResponse.json({
    rtmpUrl,
    hlsBase,
    streamKeyLast4: keyRow?.key_last4 || null,
    hasStreamKey: Boolean(keyRow),
    config: cfgRow || null,
  });
}

