import { NextResponse } from 'next/server';
import { THUMBNAIL_BUCKET, VIDEO_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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

  const formData = await request.formData();
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const tags = parseTags(formData.get('tags') as string | null);
  const video = formData.get('video');
  const thumbnail = formData.get('thumbnail');

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (!(video instanceof File) || !video.type.startsWith('video/')) {
    return NextResponse.json({ error: 'Invalid video file' }, { status: 400 });
  }

  if (!(thumbnail instanceof File) || !thumbnail.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Invalid thumbnail image' }, { status: 400 });
  }

  const videoExt = video.name.split('.').pop() || 'mp4';
  const thumbExt = thumbnail.name.split('.').pop() || 'jpg';
  const videoPath = `${user.id}/${crypto.randomUUID()}.${videoExt}`;
  const thumbnailPath = `${user.id}/${crypto.randomUUID()}.${thumbExt}`;

  const { error: videoErr } = await supabase.storage
    .from(VIDEO_BUCKET)
    .upload(videoPath, video, {
      contentType: video.type,
      upsert: false,
    });

  if (videoErr) {
    return NextResponse.json({ error: videoErr.message }, { status: 400 });
  }

  const { error: thumbErr } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .upload(thumbnailPath, thumbnail, {
      contentType: thumbnail.type,
      upsert: false,
    });

  if (thumbErr) {
    return NextResponse.json({ error: thumbErr.message }, { status: 400 });
  }

  const videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(videoPath).data.publicUrl;
  const thumbnailUrl = supabase.storage
    .from(THUMBNAIL_BUCKET)
    .getPublicUrl(thumbnailPath).data.publicUrl;

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
