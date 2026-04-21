'use client';

import { FormEvent, useEffect, useState } from 'react';
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

type ObsInfo = {
  rtmpUrl: string;
  hlsBase: string;
  streamKeyLast4: string | null;
  hasStreamKey: boolean;
  config:
    | {
        title: string;
        description: string;
        thumbnail_url: string | null;
        updated_at: string;
      }
    | null;
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
  const [obs, setObs] = useState<ObsInfo | null>(null);
  const [obsKeyReveal, setObsKeyReveal] = useState<string | null>(null);
  const [obsBusy, setObsBusy] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  async function loadObsInfo() {
    setObsError(null);
    const res = await fetch('/api/obs', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as Partial<ObsInfo> & { error?: string };
    if (!res.ok) throw new Error(data.error || 'Could not load OBS settings.');
    setObs({
      rtmpUrl: String(data.rtmpUrl || ''),
      hlsBase: String(data.hlsBase || ''),
      streamKeyLast4: (data.streamKeyLast4 as string | null) ?? null,
      hasStreamKey: Boolean(data.hasStreamKey),
      config: (data.config as ObsInfo['config']) ?? null,
    });
  }

  async function uploadObsThumbnail(file: File) {
    const allowed = new Set(['image/jpeg', 'image/png']);
    if (!allowed.has(file.type)) throw new Error('Thumbnail must be a PNG or JPEG image.');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in again.');

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ext === 'png' ? 'png' : 'jpg';
    const path = `${user.id}/live-obs/default.${safeExt}`;

    const { error: uploadErr } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });
    if (uploadErr) throw new Error(uploadErr.message);

    return supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function saveObsConfig() {
    setObsBusy(true);
    setObsError(null);
    try {
      const thumbnailUrl = thumbnailFile ? await uploadObsThumbnail(thumbnailFile) : null;
      const res = await fetch('/api/obs/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, thumbnail_url: thumbnailUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not save OBS settings.');
      await loadObsInfo();
    } catch (err) {
      setObsError((err as Error).message);
    } finally {
      setObsBusy(false);
    }
  }

  async function rotateObsKey() {
    setObsBusy(true);
    setObsError(null);
    setObsKeyReveal(null);
    try {
      const res = await fetch('/api/obs/rotate', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { streamKey?: string; streamKeyLast4?: string; error?: string };
      if (!res.ok || !data.streamKey) throw new Error(data.error || 'Could not generate stream key.');
      setObsKeyReveal(data.streamKey);
      setObs((prev) =>
        prev
          ? { ...prev, hasStreamKey: true, streamKeyLast4: data.streamKeyLast4 || null }
          : prev,
      );
    } catch (err) {
      setObsError((err as Error).message);
    } finally {
      setObsBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadObsInfo().catch((err) => {
      setObsError((err as Error).message || 'Could not load OBS settings.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div className="mt-6 rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">OBS Streaming (RTMP)</h3>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200">
            Advanced
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Stream using OBS with a stream key. This requires an RTMP ingest server that converts your stream to HLS for playback.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
            <p className="text-sm font-semibold text-zinc-200">Server URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
                {obs?.rtmpUrl || '(set NEXT_PUBLIC_RTMP_INGEST_URL)'}
              </code>
              <button
                type="button"
                onClick={() => void copy(obs?.rtmpUrl || '')}
                className="rounded-full border border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-800"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
            <p className="text-sm font-semibold text-zinc-200">Stream key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
                {obsKeyReveal
                  ? obsKeyReveal
                  : obs?.hasStreamKey
                    ? `••••••••••••••••••••••••••••••••••••${obs.streamKeyLast4 || ''}`
                    : 'No key yet'}
              </code>
              <button
                type="button"
                onClick={() => void rotateObsKey()}
                disabled={obsBusy}
                className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-60"
              >
                {obsBusy ? 'Working…' : obs?.hasStreamKey ? 'Rotate' : 'Generate'}
              </button>
              {obsKeyReveal ? (
                <button
                  type="button"
                  onClick={() => void copy(obsKeyReveal)}
                  className="rounded-full border border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-800"
                >
                  Copy
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveObsConfig()}
              disabled={obsBusy}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800 disabled:opacity-60"
            >
              {obsBusy ? 'Saving…' : 'Save OBS details'}
            </button>
            <p className="text-xs text-zinc-400">
              Title/description/thumbnail above will be used when your OBS stream goes live.
            </p>
          </div>

          {obsError ? <p className="text-sm text-red-400">{obsError}</p> : null}
          {obsKeyReveal ? (
            <p className="text-xs text-zinc-400">
              This stream key is shown once. Store it somewhere safe. Rotate if you need a new one.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
