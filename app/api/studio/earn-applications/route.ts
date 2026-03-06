import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,username,subscribers_count')
    .eq('id', user.id)
    .maybeSingle();

  const { data: application, error } = await supabase
    .from('earn_applications')
    .select('id,full_name,email,channel_focus,why_join,status,admin_notes,created_at,reviewed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    profile: profile || null,
    eligible: Number(profile?.subscribers_count || 0) >= 500,
    application: application || null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscribers_count')
    .eq('id', user.id)
    .maybeSingle();

  if (Number(profile?.subscribers_count || 0) < 500) {
    return NextResponse.json({ error: 'You need at least 500 subscribers to apply.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    full_name?: string;
    email?: string;
    channel_focus?: string;
    why_join?: string;
  };

  const fullName = String(body.full_name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  const channelFocus = String(body.channel_focus || '').trim().slice(0, 300);
  const whyJoin = String(body.why_join || '').trim().slice(0, 3000);

  if (!fullName || !email || !whyJoin) {
    return NextResponse.json({ error: 'Full name, email, and application reason are required.' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('earn_applications')
    .select('id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && existing.status !== 'pending') {
    return NextResponse.json({ error: 'Application already reviewed. Contact support for updates.' }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    full_name: fullName,
    email,
    channel_focus: channelFocus,
    why_join: whyJoin,
    status: 'pending',
  };

  const query = supabase.from('earn_applications');
  const { data, error } = existing
    ? await query
        .update(payload)
        .eq('id', existing.id)
        .select('id,full_name,email,channel_focus,why_join,status,admin_notes,created_at,reviewed_at')
        .single()
    : await query
        .insert(payload)
        .select('id,full_name,email,channel_focus,why_join,status,admin_notes,created_at,reviewed_at')
        .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ application: data });
}

