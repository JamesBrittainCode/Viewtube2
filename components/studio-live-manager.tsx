'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { THUMBNAIL_BUCKET } from '@/lib/constants';

type LiveStream = {
  id: string;
  title: string;
  description: string;
  thumbnail_url?: string | null;
  is_live: boolean;
  started_at: string;
};

export function StudioLiveManager({
  activeStream,
}: {
  activeStream: LiveStream | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState(activeStream?.title || 'Live Stream');
  const [description, setDescription] = useState(activeStream?.description || '');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadStreamThumbnail(streamId: string, file: File) {
    const allowed = new Set(['image/jpeg', 'image/png']);
    if (!allowed.has(file.type)) throw new Error('Thumbnail must be a PNG or JPEG image.');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in again.');

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ext === 'png' ? 'png' : 'jpg';
    // Storage RLS for the `thumbnails` bucket expects the first folder segment to be the user id.
    const path = `${user.id}/live-streams/${streamId}.${safeExt}`;

    const { error: uploadErr } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });
    if (uploadErr) throw new Error(uploadErr.message);

    const url = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path).data.publicUrl;
    const res = await fetch(`/api/live/streams/${streamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', title, description, thumbnail_url: url }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Could not save stream thumbnail.');

    return url;
  }

  async function startStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/live/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      const data = (await res.json()) as { stream?: LiveStream; error?: string };
      if (!res.ok || !data.stream) throw new Error(data.error || 'Could not start stream.');

      if (thumbnailFile) {
        await uploadStreamThumbnail(data.stream.id, thumbnailFile);
      } else {
        // Still persist title/description edits before launching the room.
        await fetch(`/api/live/streams/${data.stream.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', title, description, thumbnail_url: data.stream.thumbnail_url ?? null }),
        }).catch(() => null);
      }

      router.push(`/live/${data.stream.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function endStream() {
    if (!activeStream) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/streams/${activeStream.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', title, description }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not end stream.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
      <h2 className="text-xl font-semibold">Live Control Room</h2>
      <p className="text-sm text-zinc-400">
        Start a live stream from your browser camera and microphone. No third-party software required.
      </p>

      <form onSubmit={startStream} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-start">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
            <Image
              src={
                thumbnailPreview ||
                activeStream?.thumbnail_url ||
                '/thumbnail-placeholder.svg'
              }
              alt="Stream thumbnail preview"
              fill
              className="object-cover"
              sizes="160px"
            />
          </div>
          <label className="space-y-2">
            <span className="block text-sm font-semibold text-zinc-200">Stream thumbnail (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setError(null);
                setThumbnailFile(file);
                if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
                setThumbnailPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-700"
            />
            <p className="text-xs text-zinc-400">PNG or JPEG only.</p>
          </label>
        </div>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Stream title"
          required
          maxLength={120}
          className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Stream description"
          rows={3}
          maxLength={1000}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
        />

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {activeStream?.is_live ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/live/${activeStream.id}`)}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              Open Live Stream
            </button>
            <button
              type="button"
              onClick={() => void endStream()}
              disabled={loading}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {loading ? 'Ending…' : 'End Live Stream'}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {loading ? 'Starting…' : 'Go Live'}
          </button>
        )}
      </form>
    </div>
  );
}
