'use client';

import { THUMBNAIL_BUCKET, VIDEO_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { uploadResumableToSupabase } from '@/lib/supabase/resumable-upload';
import { compressVideoIfNeeded } from '@/lib/video-compress';
import { getVideoDurationSeconds } from '@/lib/video-metadata';

export type UploadStage =
  | 'idle'
  | 'preparing'
  | 'compressing'
  | 'uploading_video'
  | 'uploading_thumbnail'
  | 'publishing'
  | 'done'
  | 'error';

export type UploadState = {
  stage: UploadStage;
  overall: number; // 0..1
  detail: string;
  error: string | null;
  videoId: string | null;
};

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

let state: UploadState = {
  stage: 'idle',
  overall: 0,
  detail: '',
  error: null,
  videoId: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

export function getUploadState() {
  return state;
}

export function subscribeUploadState(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setState(patch: Partial<UploadState>) {
  state = { ...state, ...patch };
  emit();
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export async function startVideoUploadTask(input: {
  title: string;
  description: string;
  tags: string;
  commentsEnabled: boolean;
  video: File;
  thumbnail: File;
}) {
  // Prevent parallel tasks.
  if (state.stage !== 'idle' && state.stage !== 'done' && state.stage !== 'error') return;

  setState({ stage: 'preparing', overall: 0.02, detail: 'Preparing upload…', error: null, videoId: null });

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in before uploading.');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Session expired. Please sign in again.');

    let video = input.video;

    if (video.size > MAX_VIDEO_BYTES) {
      setState({ stage: 'compressing', overall: 0.05, detail: 'Compressing video to fit under 50MB…' });
      video = await compressVideoIfNeeded(video, {
        maxBytes: MAX_VIDEO_BYTES,
        onProgress: (progress) => {
          // Map compression into 5%..35%
          setState({
            overall: clamp01(0.05 + progress * 0.30),
            detail: `Compressing video… ${Math.round(progress * 100)}%`,
          });
        },
      });
    }

    setState({ stage: 'preparing', overall: 0.34, detail: 'Reading video details…' });
    const durationSeconds = await getVideoDurationSeconds(video);

    const videoExt = video.name.split('.').pop() || 'mp4';
    const thumbExt = input.thumbnail.name.split('.').pop() || 'jpg';
    const videoPath = `${user.id}/${crypto.randomUUID()}.${videoExt}`;
    const thumbnailPath = `${user.id}/${crypto.randomUUID()}.${thumbExt}`;

    setState({ stage: 'uploading_video', overall: 0.36, detail: 'Uploading video…' });
    await uploadResumableToSupabase({
      file: video,
      bucket: VIDEO_BUCKET,
      objectPath: videoPath,
      accessToken: session.access_token,
      onProgress: (pct) => {
        const progress = clamp01((pct || 0) / 100);
        // Map upload into 35%..85%
        setState({
          overall: clamp01(0.35 + progress * 0.50),
          detail: `Uploading video… ${Math.round(progress * 100)}%`,
        });
      },
    });

    setState({ stage: 'uploading_thumbnail', overall: 0.86, detail: 'Uploading thumbnail…' });
    const { error: thumbErr } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(thumbnailPath, input.thumbnail, {
      contentType: input.thumbnail.type || 'image/jpeg',
      upsert: false,
    });
    if (thumbErr) throw new Error(thumbErr.message);

    const videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(videoPath).data.publicUrl;
    const thumbnailUrl = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl;

    setState({ stage: 'publishing', overall: 0.93, detail: 'Publishing…' });
    const res = await fetch('/api/videos/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        tags: input.tags,
        comments_enabled: input.commentsEnabled,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        duration_seconds: Math.round(durationSeconds || 0),
      }),
    });

    const text = await res.text();
    let payload: { id?: string; error?: string } = {};
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      payload = { error: text || 'Upload failed' };
    }
    if (!res.ok || !payload.id) {
      throw new Error(payload.error || 'Upload failed');
    }

    setState({ stage: 'done', overall: 1, detail: 'Done', videoId: payload.id, error: null });
  } catch (err) {
    setState({
      stage: 'error',
      overall: Math.max(0.02, state.overall),
      detail: 'Upload failed',
      error: (err as Error).message || 'Upload failed',
    });
  }
}

export function resetVideoUploadTask() {
  setState({ stage: 'idle', overall: 0, detail: '', error: null, videoId: null });
}
