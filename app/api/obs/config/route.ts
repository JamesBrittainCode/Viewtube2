import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    thumbnail_url?: string | null;
  };

  const title = String(body.title || 'Live Stream').trim().slice(0, 120) || 'Live Stream';
  const description = String(body.description || '').trim().slice(0, 1000);
  const thumbnail_url =
    typeof body.thumbnail_url === 'string' && body.thumbnail_url.trim().length
      ? body.thumbnail_url.trim()
      : null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,can_stream_live,suspended')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.suspended) return NextResponse.json({ error: 'Account is suspended' }, { status: 403 });
  if (!profile.can_stream_live) return NextResponse.json({ error: 'Live streaming not enabled' }, { status: 403 });

  const { error } = await supabase
    .from('live_stream_configs')
    .upsert(
      { user_id: user.id, title, description, thumbnail_url, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

