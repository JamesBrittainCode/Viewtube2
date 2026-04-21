import { NextResponse } from 'next/server';
import { parseAndAuthorizeObsIngest } from '@/app/api/ingest/obs/_shared';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await parseAndAuthorizeObsIngest(request);
  if (!auth.ok) return auth.res;

  const { admin, userId, parsed } = auth;

  // End all currently-live OBS streams for this user matching this stream name.
  const endedAt = new Date().toISOString();
  const { error } = await admin
    .from('live_streams')
    .update({ is_live: false, ended_at: endedAt, viewer_count: 0 })
    .eq('user_id', userId)
    .eq('is_live', true)
    .eq('source', 'obs')
    .eq('ingest_stream_name', parsed.streamKey);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

