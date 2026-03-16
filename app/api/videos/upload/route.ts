import { NextResponse } from 'next/server';
import { THUMBNAIL_BUCKET, VIDEO_BUCKET } from '@/lib/constants';
import { isAdminEmail } from '@/lib/admin';
import { moderateUploadedMedia } from '@/lib/media-moderation';
import { moderateUploadText } from '@/lib/moderation';
import { sendNotification } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import { getSupportEmail } from '@/lib/support';

export const runtime = 'edge';

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 15);
}

function hasAllowedThumbnailExtension(url: string) {
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png');
}

function extractStoragePath(publicUrl: string, projectUrl: string, bucket: string): string | null {
  const prefix = `${projectUrl}/storage/v1/object/public/${bucket}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  return decodeURIComponent(publicUrl.slice(prefix.length));
}

export async function POST(request: Request) {
  const supportEmail = getSupportEmail();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isAdmin = isAdminEmail(user.email);

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    tags?: string[] | string;
    comments_enabled?: boolean;
    video_url?: string;
    thumbnail_url?: string;
    duration_seconds?: number;
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
  const commentsEnabled = body.comments_enabled !== false;
  const durationSecondsRaw = Number(body.duration_seconds);
  const durationSeconds = Number.isFinite(durationSecondsRaw) && durationSecondsRaw > 0
    ? Math.min(60 * 60 * 24, Math.round(durationSecondsRaw))
    : null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('suspended')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.suspended && !isAdmin) {
    return NextResponse.json(
      {
        error:
          `Your account is suspended. Contact ${supportEmail} for help.`,
      },
      { status: 403 },
    );
  }

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

  if (!hasAllowedThumbnailExtension(thumbnailUrl)) {
    return NextResponse.json(
      { error: 'Thumbnail must be a PNG or JPEG image.' },
      { status: 400 },
    );
  }

  const moderation = isAdmin
    ? { flagged: false as const, reason: undefined }
    : moderateUploadText({ title, description, tags });
  let mediaModeration: { flagged: boolean; reason?: string } = { flagged: false };
  const requireMediaModeration = process.env.REQUIRE_MEDIA_MODERATION !== 'false';
  // If moderation is disabled, do not call external providers at all.
  if (!moderation.flagged && !isAdmin && requireMediaModeration) {
    try {
      mediaModeration = await moderateUploadedMedia({
        videoUrl,
        thumbnailUrl,
      });
    } catch (err) {
      const message = (err as Error).message || 'Media moderation service failed';
      if (requireMediaModeration) {
        return NextResponse.json(
          {
            error: `Media moderation service is currently unavailable. ${message}`,
          },
          { status: 502 },
        );
      }
      mediaModeration = { flagged: false };
    }
  }

  if (moderation.flagged || mediaModeration.flagged) {
    const videoPath = extractStoragePath(videoUrl, projectUrl, VIDEO_BUCKET);
    const thumbnailPath = extractStoragePath(thumbnailUrl, projectUrl, THUMBNAIL_BUCKET);

    if (videoPath) {
      await supabase.storage.from(VIDEO_BUCKET).remove([videoPath]);
    }
    if (thumbnailPath) {
      await supabase.storage.from(THUMBNAIL_BUCKET).remove([thumbnailPath]);
    }

    const { data: violationData } = await supabase.rpc('record_moderation_violation', {
      target_user_id: user.id,
      violation_reason: moderation.flagged ? moderation.reason : mediaModeration.reason,
      input_title: title,
      input_description: description,
      input_tags: tags,
      input_video_url: videoUrl,
      input_thumbnail_url: thumbnailUrl,
    });

    const violation = Array.isArray(violationData) ? violationData[0] : violationData;
    const strikes = Number(violation?.strikes || 0);
    const suspended = Boolean(violation?.is_suspended);

    if (suspended) {
      await sendNotification(supabase, {
        userId: user.id,
        type: 'account_suspended',
        message:
          `Your account has been suspended after repeated moderation violations. Contact ${supportEmail}.`,
        targetUrl: '/suspended',
      });
      return NextResponse.json(
        {
          error:
            `Upload blocked by moderation. Your account is now suspended after 5 violations. Contact ${supportEmail}.`,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error: `Upload blocked by moderation (${strikes}/5 strikes). ${
          moderation.flagged ? moderation.reason : mediaModeration.reason
        }`,
      },
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
      comments_enabled: commentsEnabled,
      thumbnail_url: thumbnailUrl,
      video_url: videoUrl,
      duration_seconds: durationSeconds,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
