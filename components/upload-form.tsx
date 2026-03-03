'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { THUMBNAIL_BUCKET, VIDEO_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Upload failed';
  } catch {
    return text || 'Upload failed';
  }
}

export function UploadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const video = formData.get('video') as File;
    const thumbnail = formData.get('thumbnail') as File;

    if (!video || !video.type.startsWith('video/')) {
      setError('Please upload a valid video file.');
      return;
    }

    if (!thumbnail || !thumbnail.type.startsWith('image/')) {
      setError('Please upload a valid image thumbnail.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Please sign in before uploading.');
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
      if (videoErr) throw new Error(videoErr.message);

      const { error: thumbErr } = await supabase.storage
        .from(THUMBNAIL_BUCKET)
        .upload(thumbnailPath, thumbnail, {
          contentType: thumbnail.type,
          upsert: false,
        });
      if (thumbErr) throw new Error(thumbErr.message);

      const videoUrl = supabase.storage
        .from(VIDEO_BUCKET)
        .getPublicUrl(videoPath).data.publicUrl;
      const thumbnailUrl = supabase.storage
        .from(THUMBNAIL_BUCKET)
        .getPublicUrl(thumbnailPath).data.publicUrl;

      const res = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: String(formData.get('title') || ''),
          description: String(formData.get('description') || ''),
          tags: String(formData.get('tags') || ''),
          comments_enabled: formData.get('comments_enabled') === 'on',
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = await res.json();
      router.push(`/watch/${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-3xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h1 className="text-2xl font-bold">Upload video</h1>

      <input
        name="title"
        placeholder="Title"
        required
        maxLength={120}
        className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <textarea
        name="description"
        placeholder="Description"
        rows={5}
        className="w-full rounded-xl border border-zinc-300 bg-white p-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
      />
      <input
        name="tags"
        placeholder="Tags (comma-separated)"
        className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
      />

      <div className="space-y-2 text-sm">
        <label className="block font-medium">Video file</label>
        <input name="video" type="file" accept="video/*" required className="block w-full" />
      </div>

      <div className="space-y-2 text-sm">
        <label className="block font-medium">Thumbnail image</label>
        <input name="thumbnail" type="file" accept="image/*" required className="block w-full" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="comments_enabled" type="checkbox" defaultChecked className="h-4 w-4" />
        Allow comments
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-white dark:text-zinc-900"
      >
        {loading ? 'Uploading...' : 'Publish video'}
      </button>
    </form>
  );
}
