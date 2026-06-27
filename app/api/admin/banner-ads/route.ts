import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

function toIsoOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const selectFields =
  'id,title,image_url,click_url,placement,approved,is_active,starts_at,ends_at,impressions_count,clicks_count,created_at';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return { supabase, user: null };
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('banner_ads')
    .select(selectFields)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ banner_ads: data || [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    title?: string;
    image_url?: string;
    click_url?: string;
    placement?: string;
    approved?: boolean;
    is_active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  };

  const title = String(body.title || '').trim() || 'Sponsored';
  const imageUrl = String(body.image_url || '').trim();
  const clickUrl = String(body.click_url || '').trim();
  const placement = String(body.placement || 'home_top').trim() || 'home_top';
  const startsAt = toIsoOrNull(body.starts_at);
  const endsAt = toIsoOrNull(body.ends_at);

  if (!imageUrl || !clickUrl) {
    return NextResponse.json({ error: 'image_url and click_url are required' }, { status: 400 });
  }
  try {
    new URL(clickUrl);
  } catch {
    return NextResponse.json({ error: 'click_url must be a valid URL' }, { status: 400 });
  }
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('banner_ads')
    .insert({
      title,
      image_url: imageUrl,
      click_url: clickUrl,
      placement,
      approved: body.approved !== false,
      is_active: body.is_active !== false,
      starts_at: startsAt,
      ends_at: endsAt,
      created_by: user.id,
    })
    .select(selectFields)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ banner_ad: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    id?: string;
    title?: string;
    image_url?: string;
    click_url?: string;
    placement?: string;
    approved?: boolean;
    is_active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  };

  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const patch: {
    title?: string;
    image_url?: string;
    click_url?: string;
    placement?: string;
    approved?: boolean;
    is_active?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  } = {};

  if (body.title !== undefined) patch.title = String(body.title || '').trim() || 'Sponsored';
  if (body.image_url !== undefined) {
    const imageUrl = String(body.image_url || '').trim();
    if (!imageUrl) return NextResponse.json({ error: 'image_url cannot be empty' }, { status: 400 });
    patch.image_url = imageUrl;
  }
  if (body.click_url !== undefined) {
    const clickUrl = String(body.click_url || '').trim();
    if (!clickUrl) return NextResponse.json({ error: 'click_url cannot be empty' }, { status: 400 });
    try {
      new URL(clickUrl);
    } catch {
      return NextResponse.json({ error: 'click_url must be a valid URL' }, { status: 400 });
    }
    patch.click_url = clickUrl;
  }
  if (body.placement !== undefined) patch.placement = String(body.placement || 'home_top').trim() || 'home_top';
  if (typeof body.approved === 'boolean') patch.approved = body.approved;
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (body.starts_at !== undefined) patch.starts_at = toIsoOrNull(body.starts_at);
  if (body.ends_at !== undefined) patch.ends_at = toIsoOrNull(body.ends_at);

  if (
    patch.starts_at &&
    patch.ends_at &&
    new Date(patch.ends_at).getTime() <= new Date(patch.starts_at).getTime()
  ) {
    return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('banner_ads')
    .update(patch)
    .eq('id', body.id)
    .select(selectFields)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ banner_ad: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabase.from('banner_ads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id });
}
