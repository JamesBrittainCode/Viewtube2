import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { normalizeHandle } from '@/lib/handle';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type TargetProfile = {
  id: string;
  username?: string | null;
  handle?: string | null;
};

async function findProfileByEmail(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    target?: string;
    points?: number;
    note?: string;
  };

  const target = String(body.target || '').trim();
  const points = Math.max(0, Math.floor(Number(body.points || 0)));
  const note = String(body.note || '').trim().slice(0, 180);

  if (!target) return NextResponse.json({ error: 'Enter a handle or email.' }, { status: 400 });
  if (points <= 0) return NextResponse.json({ error: 'Points must be greater than 0.' }, { status: 400 });
  if (points > 100000) return NextResponse.json({ error: 'Points amount is too large.' }, { status: 400 });

  const adminClient = createAdminClient();
  let profile: TargetProfile | null = null;

  if (target.includes('@') && !target.startsWith('@')) {
    const targetUserId = await findProfileByEmail(adminClient, target);
    if (targetUserId) {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id,username,handle')
        .eq('id', targetUserId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      profile = data;
    }
  } else {
    const handle = normalizeHandle(target);
    const { data, error } = await adminClient.from('profiles').select('id,username,handle').eq('handle', handle).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    profile = data;
  }

  if (!profile) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  const { data: award, error: awardError } = await adminClient.rpc('award_viewtube_points', {
    target_user_id: profile.id,
    activity_type: 'admin_bonus',
    target_id: `admin:${user.id}:${Date.now()}:${note || 'manual'}`,
    points_delta: points,
  });

  if (awardError) return NextResponse.json({ error: awardError.message }, { status: 400 });

  return NextResponse.json({ profile, award });
}
