import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashStreamKey } from '@/lib/obs/stream-key';

type ParsedIngest = {
  streamKey: string;
  app?: string | null;
  raw: Record<string, unknown>;
};

async function readBody(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>;
  }
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const out: Record<string, unknown> = {};
    if (form) {
      for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : String(v);
    }
    return out;
  }
  const text = await request.text().catch(() => '');
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { _raw: text };
  }
}

export async function parseAndAuthorizeObsIngest(request: Request): Promise<
  | { ok: true; admin: ReturnType<typeof createAdminClient>; userId: string; parsed: ParsedIngest }
  | { ok: false; res: NextResponse }
> {
  const raw = await readBody(request);
  const expected = process.env.INGEST_WEBHOOK_SECRET || '';
  const urlSecret = new URL(request.url).searchParams.get('secret') || '';
  const got =
    request.headers.get('x-viewtube-ingest-secret') ||
    String(raw.secret || '') ||
    urlSecret ||
    '';
  if (!expected || got !== expected) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const streamKey =
    String(raw.streamKey || raw.stream_key || raw.key || raw.name || raw.stream || '').trim();
  if (!streamKey) {
    return { ok: false, res: NextResponse.json({ error: 'Missing stream key' }, { status: 400 }) };
  }

  const admin = createAdminClient();
  const keyHash = hashStreamKey(streamKey);
  const { data: keyRow, error: keyErr } = await admin
    .from('live_stream_keys')
    .select('user_id')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (keyErr || !keyRow) {
    return { ok: false, res: NextResponse.json({ error: 'Invalid stream key' }, { status: 403 }) };
  }

  return { ok: true, admin, userId: keyRow.user_id as string, parsed: { streamKey, app: String(raw.app || ''), raw } };
}
