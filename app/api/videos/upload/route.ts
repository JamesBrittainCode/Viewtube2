import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 15);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    tags?: string[] | string;
    video_url?: string;
    thumbnail_url?: string;
  };
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const tags = Array.isArray(body.tags)
    ? body.tags
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 15)
    : parseTags(typeof body.tags === 'string' ? body.tags : null);
  const videoUrl = String(body.video_url || '').trim();
  const thumbnailUrl = String(body.thumbnail_url || '').trim();

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (!videoUrl || !thumbnailUrl) {
    return NextResponse.json(
      { error: 'Video and thumbnail URLs are required' },
      { status: 400 },
    );
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publicPrefix = `${projectUrl}/storage/v1/object/public/`;
  if (!videoUrl.startsWith(publicPrefix) || !thumbnailUrl.startsWith(publicPrefix)) {
    return NextResponse.json(
      { error: 'Invalid storage URLs. Upload to Supabase Storage first.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      title,
      description,
      tags,
      thumbnail_url: thumbnailUrl,
      video_url: videoUrl,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
