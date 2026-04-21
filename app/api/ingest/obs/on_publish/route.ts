import { NextResponse } from 'next/server';
import { parseAndAuthorizeObsIngest } from '@/app/api/ingest/obs/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await parseAndAuthorizeObsIngest(request);
  if (!auth.ok) return auth.res;

  const { admin, userId, parsed } = auth;
  const startedAt = new Date().toISOString();

  const [{ data: profile }, { data: cfg }] = await Promise.all([
    admin.from('profiles').select('id,can_stream_live,suspended').eq('id', userId).maybeSingle(),
    admin
      .from('live_stream_configs')
      .select('title,description,thumbnail_url')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.suspended) return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
  if (!profile.can_stream_live) return NextResponse.json({ error: 'Live streaming not enabled' }, { status: 403 });

  const title = String(cfg?.title || 'Live Stream').trim().slice(0, 120) || 'Live Stream';
  const description = String(cfg?.description || '').trim().slice(0, 1000);
  const thumbnail_url =
    typeof cfg?.thumbnail_url === 'string' && cfg.thumbnail_url.trim().length ? cfg.thumbnail_url.trim() : null;

  // Reuse an existing live row if one exists, otherwise create a new one.
  const { data: existing } = await admin
    .from('live_streams')
    .select('id')
    .eq('user_id', userId)
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from('live_streams')
      .update({
        title,
        description,
        thumbnail_url,
        source: 'obs',
        ingest_stream_name: parsed.streamKey,
        is_live: true,
        viewer_count: 0,
        started_at: startedAt,
        ended_at: null,
      })
      .eq('id', existing.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, stream_id: existing.id });
  }

  const { data: inserted, error: insertErr } = await admin
    .from('live_streams')
    .insert({
      user_id: userId,
      title,
      description,
      thumbnail_url,
      source: 'obs',
      ingest_stream_name: parsed.streamKey,
      is_live: true,
      viewer_count: 0,
      started_at: startedAt,
    })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });
  return NextResponse.json({ ok: true, stream_id: inserted?.id });
}

