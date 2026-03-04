import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

function toIsoOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ads')
    .select(
      'id,title,video_url,click_url,thumbnail_url,runtime_seconds,target_reach,calculated_price_usd,skippable,approved,starts_at,ends_at,is_active,source_submission_id,impressions_count,clicks_count,completions_count,last_served_at,created_at',
    )
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ads: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    video_url?: string;
    click_url?: string;
    thumbnail_url?: string;
    runtime_seconds?: number;
    target_reach?: number;
    calculated_price_usd?: number;
    skippable?: boolean;
    is_active?: boolean;
    approved?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  };

  const title = String(body.title || '').trim();
  const videoUrl = String(body.video_url || '').trim();
  const clickUrl = String(body.click_url || '').trim();
  const thumbnailUrl = String(body.thumbnail_url || '').trim();
  const runtimeSeconds = Math.max(0, Number(body.runtime_seconds || 0));
  const targetReach = body.target_reach ? Math.max(0, Number(body.target_reach || 0)) : null;
  const calculatedPriceUsd = body.calculated_price_usd ? Math.max(0, Number(body.calculated_price_usd || 0)) : null;
  const skippable = body.skippable !== false;
  const isActive = body.is_active !== false;
  const approved = body.approved !== false;
  const startsAt = toIsoOrNull(body.starts_at);
  const endsAt = toIsoOrNull(body.ends_at);

  if (!title || !videoUrl || !clickUrl) {
    return NextResponse.json(
      { error: 'title, video_url, and click_url are required' },
      { status: 400 },
    );
  }
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ads')
    .insert({
      title,
      video_url: videoUrl,
      click_url: clickUrl,
      thumbnail_url: thumbnailUrl || null,
      runtime_seconds: runtimeSeconds,
      target_reach: targetReach,
      calculated_price_usd: calculatedPriceUsd,
      skippable,
      approved,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: isActive,
      created_by: user.id,
    })
    .select(
      'id,title,video_url,click_url,thumbnail_url,runtime_seconds,target_reach,calculated_price_usd,skippable,approved,starts_at,ends_at,is_active,source_submission_id,impressions_count,clicks_count,completions_count,last_served_at,created_at',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ad: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    is_active?: boolean;
    approved?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const patch: {
    is_active?: boolean;
    approved?: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
  } = {};

  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (typeof body.approved === 'boolean') patch.approved = body.approved;
  if (body.starts_at !== undefined) patch.starts_at = toIsoOrNull(body.starts_at);
  if (body.ends_at !== undefined) patch.ends_at = toIsoOrNull(body.ends_at);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
  }

  if (
    patch.starts_at &&
    patch.ends_at &&
    new Date(patch.ends_at).getTime() <= new Date(patch.starts_at).getTime()
  ) {
    return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ads')
    .update(patch)
    .eq('id', body.id)
    .select(
      'id,title,video_url,click_url,thumbnail_url,runtime_seconds,target_reach,calculated_price_usd,skippable,approved,starts_at,ends_at,is_active,source_submission_id,impressions_count,clicks_count,completions_count,last_served_at,created_at',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ad: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase.from('ads').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id });
}
