import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = isAdminEmail(user.email);
  const baseQuery = supabase
    .from('studio_feedback')
    .select('id,user_id,subject,message,status,created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  const { data: feedback, error } = admin ? await baseQuery : await baseQuery.eq('user_id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = feedback || [];
  if (!admin || !list.length) {
    return NextResponse.json({ feedback: list, is_admin: admin });
  }

  const userIds = Array.from(new Set(list.map((item) => item.user_id).filter(Boolean)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,username,handle')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, { username: profile.username, handle: profile.handle }]),
  );
  const withProfiles = list.map((item) => ({
    ...item,
    profile: profileMap.get(item.user_id) || null,
  }));

  return NextResponse.json({ feedback: withProfiles, is_admin: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { subject?: string; message?: string };
  const subject = String(body.subject || '').trim().slice(0, 120);
  const message = String(body.message || '').trim().slice(0, 2000);

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('studio_feedback')
    .insert({
      user_id: user.id,
      subject,
      message,
      status: 'new',
    })
    .select('id,user_id,subject,message,status,created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ feedback: data });
}

