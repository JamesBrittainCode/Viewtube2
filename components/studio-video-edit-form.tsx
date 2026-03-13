'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { THUMBNAIL_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

type Props = {
  videoId: string;
  initialTitle: string;
  initialDescription: string;
  initialCommentsEnabled: boolean;
  initialThumbnailUrl: string | null;
};

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Update failed';
  } catch {
    return text || 'Update failed';
  }
}

export function StudioVideoEditForm({
  videoId,
  initialTitle,
  initialDescription,
  initialCommentsEnabled,
  initialThumbnailUrl,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [commentsEnabled, setCommentsEnabled] = useState(initialCommentsEnabled);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnailUrl);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ALLOWED_THUMBNAIL_TYPES = new Set(['image/png', 'image/jpeg']);

  function fileExt(name: string, fallback: string) {
    const last = name.split('.').pop()?.toLowerCase() || '';
    const safe = last.replace(/[^a-z0-9]/g, '');
    return safe || fallback;
  }

  function extractStoragePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const prefix = `${projectUrl}/storage/v1/object/public/${bucket}/`;
    if (!publicUrl.startsWith(prefix)) return null;
    return decodeURIComponent(publicUrl.slice(prefix.length));
  }

  async function uploadNewThumbnail(file: File) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in again.');

    if (!ALLOWED_THUMBNAIL_TYPES.has(file.type)) {
      throw new Error('Thumbnail must be a PNG or JPEG image.');
    }

    const ext = fileExt(file.name, file.type === 'image/png' ? 'png' : 'jpg');
    const path = `${user.id}/${videoId}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (uploadErr) throw new Error(uploadErr.message);

    const url = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path).data.publicUrl;
    return { url, path };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      let nextThumbnailUrl: string | undefined;
      let uploadedThumbPath: string | null = null;
      if (thumbnailFile) {
        const uploaded = await uploadNewThumbnail(thumbnailFile);
        nextThumbnailUrl = uploaded.url;
        uploadedThumbPath = uploaded.path;
      }

      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          comments_enabled: commentsEnabled,
          thumbnail_url: nextThumbnailUrl,
        }),
      });

      if (!res.ok) {
        // If the DB update failed, best-effort cleanup of the newly uploaded thumb.
        if (uploadedThumbPath) {
          const supabase = createClient();
          await supabase.storage.from(THUMBNAIL_BUCKET).remove([uploadedThumbPath]).catch(() => null);
        }
        throw new Error(await parseApiError(res));
      }

      // Best-effort delete the prior thumbnail object to avoid orphaned files.
      if (thumbnailFile && thumbnailUrl) {
        const oldPath = extractStoragePathFromPublicUrl(thumbnailUrl, THUMBNAIL_BUCKET);
        if (oldPath) {
          const supabase = createClient();
          await supabase.storage.from(THUMBNAIL_BUCKET).remove([oldPath]).catch(() => null);
        }
      }

      if (thumbnailFile && nextThumbnailUrl) {
        setThumbnailUrl(nextThumbnailUrl);
        setThumbnailFile(null);
        if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
        setThumbnailPreview(null);
      }

      setMessage('Video updated.');
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
      className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5"
    >
      <div>
        <label className="mb-2 block text-sm text-zinc-400">Thumbnail</label>
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
            <div className="relative aspect-video w-full">
              <Image
                src={thumbnailPreview || thumbnailUrl || '/thumbnail-placeholder.svg'}
                alt="Thumbnail preview"
                fill
                className="object-cover"
              />
            </div>
          </div>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setMessage(null);
                setError(null);
                if (!file) {
                  setThumbnailFile(null);
                  if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
                  setThumbnailPreview(null);
                  return;
                }
                if (!ALLOWED_THUMBNAIL_TYPES.has(file.type)) {
                  setError('Thumbnail must be a PNG or JPEG image (GIFs are not allowed).');
                  event.currentTarget.value = '';
                  return;
                }
                setThumbnailFile(file);
                if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
                setThumbnailPreview(URL.createObjectURL(file));
              }}
              className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-sm text-zinc-200 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-700"
            />
            <p className="text-xs text-zinc-400">
              Upload a PNG or JPEG to replace your thumbnail.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-400">Title</label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-400">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={7}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={commentsEnabled}
          onChange={(event) => setCommentsEnabled(event.target.checked)}
          className="h-4 w-4"
        />
        Allow comments
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-70"
      >
        {loading ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}
