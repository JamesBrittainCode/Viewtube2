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

  const { data, error } = await supabase
    .from('ads')
    .select('id,title,video_url,click_url,thumbnail_url,skippable,is_active,created_at')
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
    skippable?: boolean;
    is_active?: boolean;
  };

  const title = String(body.title || '').trim();
  const videoUrl = String(body.video_url || '').trim();
  const clickUrl = String(body.click_url || '').trim();
  const thumbnailUrl = String(body.thumbnail_url || '').trim();
  const skippable = body.skippable !== false;
  const isActive = body.is_active !== false;

  if (!title || !videoUrl || !clickUrl) {
    return NextResponse.json(
      { error: 'title, video_url, and click_url are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('ads')
    .insert({
      title,
      video_url: videoUrl,
      click_url: clickUrl,
      thumbnail_url: thumbnailUrl || null,
      skippable,
      is_active: isActive,
      created_by: user.id,
    })
    .select('id,title,video_url,click_url,thumbnail_url,skippable,is_active,created_at')
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
  };

  if (!body.id || typeof body.is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'id and is_active are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('ads')
    .update({ is_active: body.is_active })
    .eq('id', body.id)
    .select('id,title,video_url,click_url,thumbnail_url,skippable,is_active,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ad: data });
}
