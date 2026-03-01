import { NextResponse } from 'next/server';
import { normalizeHandle } from '@/lib/handle';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    handle?: string;
    subscribers_count?: number;
    verified?: boolean;
  };

  const rawHandle = (body.handle || '').trim();
  const normalizedRaw = rawHandle.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
  const handle = normalizeHandle(rawHandle);
  const subscribersCount = Math.max(0, Number(body.subscribers_count ?? 0));
  const verified = Boolean(body.verified);

  if (!body.handle || normalizedRaw.length < 3) {
    return NextResponse.json({ error: 'Valid handle is required' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', handle)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data, error } = await supabase.rpc('admin_update_profile_meta', {
    target_profile_id: profile.id,
    target_subscribers_count: subscribersCount,
    target_verified: verified,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
