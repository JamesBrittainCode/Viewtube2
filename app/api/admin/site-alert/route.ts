import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('site_alerts')
    .select('id,message,is_active,created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ alerts: data || [] });
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
    message?: string;
    is_active?: boolean;
  };
  const message = String(body.message || '').trim().slice(0, 800);
  const isActive = body.is_active !== false;
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  const admin = createAdminClient();
  if (isActive) {
    await admin.from('site_alerts').update({ is_active: false }).eq('is_active', true);
  }
  const { data, error } = await admin
    .from('site_alerts')
    .insert({ message, is_active: isActive, created_by: user.id })
    .select('id,message,is_active,created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ alert: data });
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
    is_active?: boolean;
  };
  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const isActive = Boolean(body.is_active);

  const admin = createAdminClient();
  if (isActive) {
    await admin.from('site_alerts').update({ is_active: false }).eq('is_active', true);
  }
  const { data, error } = await admin
    .from('site_alerts')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id,message,is_active,created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ alert: data });
}

