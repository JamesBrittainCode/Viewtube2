import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from('earn_applications')
    .select('id,user_id,full_name,email,channel_focus,why_join,status,admin_notes,created_at,reviewed_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const applications = rows || [];

  const userIds = Array.from(new Set(applications.map((item) => item.user_id)));
  const { data: profiles } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id,username,handle,subscribers_count')
        .in('id', userIds)
    : { data: [] as { id: string; username: string; handle: string; subscribers_count: number }[] };

  const profileMap = new Map((profiles || []).map((item) => [item.id, item]));
  const merged = applications.map((item) => ({
    ...item,
    profile: profileMap.get(item.user_id) || null,
  }));

  return NextResponse.json({ applications: merged });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: 'approved' | 'rejected';
    admin_notes?: string;
  };

  const id = String(body.id || '').trim();
  const status = body.status;
  const adminNotes = String(body.admin_notes || '').trim().slice(0, 1000);
  if (!id || !status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'id and valid status are required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('earn_applications')
    .update({
      status,
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', id)
    .select('id,user_id,full_name,email,channel_focus,why_join,status,admin_notes,created_at,reviewed_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ application: data });
}

