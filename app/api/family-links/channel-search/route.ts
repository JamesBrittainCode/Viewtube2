import { NextResponse } from 'next/server';
import { normalizeHandle } from '@/lib/handle';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get('q') || '').trim();
  if (query.length < 2) return NextResponse.json({ channels: [] });

  const adminClient = createAdminClient();
  const safeQuery = query.replace(/[%,]/g, '').slice(0, 60);
  const handle = normalizeHandle(safeQuery).replace('@', '');
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,is_admin,subscribers_count')
    .or(`handle.ilike.%${handle}%,username.ilike.%${safeQuery}%`)
    .neq('id', user.id)
    .order('subscribers_count', { ascending: false })
    .limit(8);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ channels: data || [] });
}
