import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const primary = await supabase
    .from('notifications')
    .select(
      'id,type,message,target_url,is_read,created_at,actor:profiles!notifications_actor_id_fkey(username,handle,avatar_url)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!primary.error) {
    return NextResponse.json({ notifications: primary.data || [] });
  }

  const fallback = await supabase
    .from('notifications')
    .select(
      'id,type,message,is_read,created_at,actor:profiles!notifications_actor_id_fkey(username,handle,avatar_url)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (fallback.error) {
    return NextResponse.json({ error: fallback.error.message }, { status: 400 });
  }

  const notifications = (fallback.data || []).map((item) => ({
    ...item,
    target_url: null,
  }));
  return NextResponse.json({ notifications });
}

export async function PATCH() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
