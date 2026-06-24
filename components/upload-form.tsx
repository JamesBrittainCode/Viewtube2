'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { FileVideo, Image as ImageIcon, MessageSquareText, Tags, Type } from 'lucide-react';
import { startVideoUploadTask, resetVideoUploadTask } from '@/lib/upload-manager';
import { formatUploadBytes, MAX_UPLOAD_BYTES } from '@/lib/upload-limits';

type GeneratedThumb = {
  id: string;
  time: number;
  blob: Blob;
  url: string;
};

const ALLOWED_THUMBNAIL_TYPES = new Set(['image/jpeg', 'image/png']);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createGeneratedThumbnails(videoFile: File): Promise<GeneratedThumb[]> {
  const videoUrl = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to read uploaded video.'));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const points = [0.15, 0.5, 0.85].map((ratio) => {
      const t = duration * ratio;
      return Math.max(0.1, Math.min(duration - 0.1, t));
    });

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const width = Math.min(1280, sourceWidth);
    const height = Math.max(1, Math.round((width / sourceWidth) * sourceHeight));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to generate thumbnail previews.');

    const results: GeneratedThumb[] = [];

    for (let i = 0; i < points.length; i += 1) {
      const time = points[i];
      await new Promise<void>((resolve, reject) => {
        video.currentTime = time;
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error('Failed to generate thumbnails from video.'));
      });

      ctx.drawImage(video, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error('Could not encode thumbnail image.'));
              return;
            }
            resolve(result);
          },
          'image/jpeg',
          0.9,
        );
      });

      results.push({
        id: `auto-${i + 1}`,
        time,
        blob,
        url: URL.createObjectURL(blob),
      });
    }

    return results;
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

export function UploadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [customThumbnailFile, setCustomThumbnailFile] = useState<File | null>(null);
  const [generatedThumbs, setGeneratedThumbs] = useState<GeneratedThumb[]>([]);
  const [selectedGeneratedThumbId, setSelectedGeneratedThumbId] = useState<string | null>(null);
  const [generatingThumbs, setGeneratingThumbs] = useState(false);
  const [thumbsVisible, setThumbsVisible] = useState(false);

  useEffect(() => {
    resetVideoUploadTask();
    return () => {
      generatedThumbs.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [generatedThumbs]);

  async function onVideoSelect(file: File | null) {
    setVideoFile(file);
    setCustomThumbnailFile(null);
    setError(null);

    generatedThumbs.forEach((item) => URL.revokeObjectURL(item.url));
    setGeneratedThumbs([]);
    setSelectedGeneratedThumbId(null);
    setThumbsVisible(false);

    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please upload a valid video file.');
      return;
    }

    setGeneratingThumbs(true);
    try {
      const start = Date.now();
      const thumbs = await createGeneratedThumbnails(file);
      const elapsed = Date.now() - start;
      const minimumDelay = 1200 + Math.floor(Math.random() * 700);
      if (elapsed < minimumDelay) {
        await sleep(minimumDelay - elapsed);
      }
      setGeneratedThumbs(thumbs);
      if (thumbs[0]) setSelectedGeneratedThumbId(thumbs[0].id);
      requestAnimationFrame(() => setThumbsVisible(true));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingThumbs(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const video = videoFile;
    const generated = generatedThumbs.find((item) => item.id === selectedGeneratedThumbId);
    const thumbnail =
      customThumbnailFile ||
      (generated
        ? new File([generated.blob], `auto-thumbnail-${generated.id}.jpg`, {
            type: 'image/jpeg',
          })
        : null);

    if (!video || !video.type.startsWith('video/')) {
      setError('Please upload a valid video file.');
      return;
    }

    if (!thumbnail || !ALLOWED_THUMBNAIL_TYPES.has(thumbnail.type)) {
      setError('Thumbnail must be a PNG or JPEG image.');
      return;
    }

    setLoading(true);

    try {
      const title = String(formData.get('title') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const tags = String(formData.get('tags') || '');
      const commentsEnabled = formData.get('comments_enabled') === 'on';

      await startVideoUploadTask({
        title,
        description,
        tags,
        commentsEnabled,
        video,
        thumbnail,
      });

      router.push('/upload/processing');
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
          <input
            name="video"
            type="file"
            accept="video/*"
            required
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              void onVideoSelect(file);
            }}
            className="mt-2 block w-full text-sm"
          />
        </label>

        <label className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
          <span className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-zinc-500" />
            Custom thumbnail (optional)
          </span>
          <input
            name="thumbnail"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              if (file && !ALLOWED_THUMBNAIL_TYPES.has(file.type)) {
                setError('Thumbnail must be a PNG or JPEG image.');
                return;
              }
              setCustomThumbnailFile(file);
              setError(null);
            }}
            className="mt-2 block w-full text-sm"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Upload a PNG/JPEG image to override auto-generated options.
          </p>
        </label>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Auto-generated thumbnails</h3>
          {customThumbnailFile && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Custom thumbnail selected
            </span>
          )}
        </div>

        {generatingThumbs && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            <p>Generating thumbnail options...</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((slot) => (
                <div
                  key={slot}
                  className="aspect-video animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800"
                />
              ))}
            </div>
          </div>
        )}

        {!generatingThumbs && generatedThumbs.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {generatedThumbs.map((thumb, index) => (
              <button
                key={thumb.id}
                type="button"
                onClick={() => {
                  setSelectedGeneratedThumbId(thumb.id);
                  setCustomThumbnailFile(null);
                }}
                style={{ transitionDelay: `${index * 90}ms` }}
                className={`overflow-hidden rounded-xl border text-left transition duration-500 ${
                  thumbsVisible ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
                } ${
                  selectedGeneratedThumbId === thumb.id && !customThumbnailFile
                    ? 'border-red-600 ring-2 ring-red-200 dark:ring-red-900'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                <img
                  src={thumb.url}
                  alt={`Auto thumbnail at ${Math.round(thumb.time)} seconds`}
                  className="aspect-video w-full object-cover"
                />
                <p className="px-3 py-2 text-xs text-zinc-500">
                  {Math.round(thumb.time)}s
                </p>
              </button>
            ))}
          </div>
        )}

        {!generatingThumbs && !generatedThumbs.length && (
          <p className="text-xs text-zinc-500">
            Select a video to generate three thumbnail choices automatically.
          </p>
        )}
      </section>

      <label className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
        <input name="comments_enabled" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
        Allow comments
      </label>

      {videoFile && videoFile.size > MAX_UPLOAD_BYTES && !loading ? (
        <p className="text-xs text-zinc-500">
          This video is over {formatUploadBytes(MAX_UPLOAD_BYTES)}. ViewTube will compress it before uploading.
        </p>
      ) : null}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? <p className="text-sm text-zinc-500">Starting upload…</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 items-center justify-center rounded-full bg-red-600 px-6 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-70"
      >
        {loading ? 'Starting…' : 'Continue'}
      </button>
    </form>
  );
}
