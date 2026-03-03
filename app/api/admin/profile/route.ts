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
    suspended?: boolean;
  };

  const rawHandle = (body.handle || '').trim();
  const normalizedRaw = rawHandle.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
  const handle = normalizeHandle(rawHandle);
  const subscribersCount =
    typeof body.subscribers_count === 'number' ? Math.max(0, Number(body.subscribers_count)) : undefined;
  const verified =
    typeof body.verified === 'boolean' ? body.verified : undefined;
  const suspended =
    typeof body.suspended === 'boolean' ? body.suspended : undefined;

  if (!body.handle || normalizedRaw.length < 3) {
    return NextResponse.json({ error: 'Valid handle is required' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, subscribers_count, verified, suspended')
    .eq('handle', handle)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (subscribersCount === undefined && verified === undefined && suspended === undefined) {
    return NextResponse.json({ error: 'No admin changes provided' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('admin_update_profile_meta', {
    target_profile_id: profile.id,
    target_subscribers_count: subscribersCount ?? profile.subscribers_count,
    target_verified: verified ?? profile.verified,
    target_suspended: suspended ?? profile.suspended,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
