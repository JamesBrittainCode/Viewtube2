import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function hasAllowedThumbnailExtension(url: string) {
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png');
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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
    visibility?: string;
    comments_enabled?: boolean;
    thumbnail_url?: string;
  };

  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const commentsEnabled =
    typeof body.comments_enabled === 'boolean' ? body.comments_enabled : undefined;
  const visibility =
    body.visibility === 'public' || body.visibility === 'unlisted' || body.visibility === 'private'
      ? body.visibility
      : undefined;
  const thumbnailUrlRaw = body.thumbnail_url;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id,user_id')
    .eq('id', id)
    .maybeSingle();

  if (videoError || !video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  if (video.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updates: {
    title: string;
    description: string;
    visibility?: 'public' | 'unlisted' | 'private';
    comments_enabled?: boolean;
    thumbnail_url?: string;
  } = {
    title,
    description,
  };

  if (commentsEnabled !== undefined) {
    updates.comments_enabled = commentsEnabled;
  }
  if (visibility !== undefined) {
    updates.visibility = visibility;
  }

  if (typeof thumbnailUrlRaw === 'string' && thumbnailUrlRaw.trim()) {
    const thumbnailUrl = thumbnailUrlRaw.trim();
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const publicPrefix = `${projectUrl}/storage/v1/object/public/`;
    if (!thumbnailUrl.startsWith(publicPrefix)) {
      return NextResponse.json(
        { error: 'Invalid thumbnail URL. Upload to Supabase Storage first.' },
        { status: 400 },
      );
    }
    if (!hasAllowedThumbnailExtension(thumbnailUrl)) {
      return NextResponse.json(
        { error: 'Thumbnail must be a PNG or JPEG image.' },
        { status: 400 },
      );
    }
    updates.thumbnail_url = thumbnailUrl;
  }

  const { error } = await supabase.from('videos').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
