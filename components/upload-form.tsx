'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { FileVideo, Image as ImageIcon, MessageSquareText, Tags, Type } from 'lucide-react';
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
      className="mx-auto w-full max-w-4xl space-y-6 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Upload video</h1>
        <p className="mt-1 text-sm text-zinc-500">Share your next ViewTube upload.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4 text-zinc-500" />
            Title
          </span>
          <input
            name="title"
            placeholder="Add a clear, descriptive title"
            required
            maxLength={120}
            className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="h-4 w-4 text-zinc-500" />
            Description
          </span>
          <textarea
            name="description"
            placeholder="Tell viewers what this video is about"
            rows={6}
            className="w-full rounded-xl border border-zinc-300 bg-white p-4 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Tags className="h-4 w-4 text-zinc-500" />
            Tags
          </span>
          <input
            name="tags"
            placeholder="e.g. tutorial, coding, react"
            className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
          <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <FileVideo className="h-4 w-4 text-zinc-500" />
            Video file
          </span>
          <input name="video" type="file" accept="video/*" required className="mt-2 block w-full text-sm" />
        </label>

        <label className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
          <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-zinc-500" />
            Thumbnail image
          </span>
          <input name="thumbnail" type="file" accept="image/*" required className="mt-2 block w-full text-sm" />
        </label>
      </div>

      <label className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
        <input name="comments_enabled" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
        Allow comments
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-70"
      >
        {loading ? 'Uploading...' : 'Publish video'}
      </button>
    </form>
  );
}
