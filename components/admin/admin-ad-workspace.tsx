'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, PlayCircle, UploadCloud } from 'lucide-react';
import { AdCompanionCard } from '@/components/ads/ad-companion-card';
import { AD_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { uploadResumableToSupabase } from '@/lib/supabase/resumable-upload';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg']);

function fileExt(name: string, fallback: string) {
  const last = name.split('.').pop()?.toLowerCase() || '';
  const safe = last.replace(/[^a-z0-9]/g, '');
  return safe || fallback;
}

async function getVideoDurationSeconds(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = objectUrl;

  try {
    return await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration || 0);
      video.onerror = () => reject(new Error('Could not read ad video metadata.'));
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Ad upload failed';
  } catch {
    return text || 'Ad upload failed';
  }
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

function InVideoPreview({
  title,
  clickUrl,
  videoUrl,
  logoUrl,
}: {
  title: string;
  clickUrl: string;
  videoUrl: string | null;
  logoUrl: string | null;
}) {
  let host = 'destination.com';
  try {
    host = new URL(clickUrl).hostname.replace(/^www\./, '');
  } catch {
    // Preview copy only.
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
      <div className="relative aspect-video bg-zinc-950">
        {videoUrl ? (
          <video src={videoUrl} preload="metadata" controls className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
            <PlayCircle className="h-12 w-12" />
            <span className="text-sm font-semibold">Upload an ad video to preview it here</span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-6 left-6 max-w-[min(460px,80%)] rounded-2xl bg-black/70 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{title || 'Your ad title'}</p>
              <p className="truncate text-xs text-zinc-300">{host}</p>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-950">Learn more</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-1.5 w-full bg-white/20" />
        <div className="absolute bottom-0 left-0 h-1.5 w-2/5 bg-yellow-400" />
      </div>
    </div>
  );
}

export function AdminAdWorkspace() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [clickUrl, setClickUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [skippable, setSkippable] = useState(true);
  const [approved, setApproved] = useState(true);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoPreviewUrl = useObjectUrl(videoFile);
  const logoPreviewUrl = useObjectUrl(logoFile);
  const bannerPreviewUrl = useObjectUrl(bannerFile);
  const previewAd = useMemo(
    () => ({
      id: 'preview',
      title: title || 'Your ad title',
      click_url: clickUrl || 'https://example.com',
      thumbnail_url: logoPreviewUrl,
      logo_url: logoPreviewUrl,
      banner_url: bannerPreviewUrl,
    }),
    [bannerPreviewUrl, clickUrl, logoPreviewUrl, title],
  );

  async function onVideoChange(file: File | null) {
    setVideoFile(file);
    setRuntimeSeconds(0);
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please choose a valid ad video file.');
      return;
    }
    const duration = Math.round(await getVideoDurationSeconds(file));
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Could not read the ad runtime.');
      return;
    }
    if (duration > 180) {
      setError('Ad video must be 3 minutes or less.');
      return;
    }
    setRuntimeSeconds(duration);
  }

  async function uploadImage(file: File | null, basePath: string, label: string) {
    if (!file) return null;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error(`${label} must be PNG or JPEG.`);
    const supabase = createClient();
    const path = `${basePath}-${label.toLowerCase()}.${fileExt(file.name, 'jpg')}`;
    const { error: uploadError } = await supabase.storage.from(AD_BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);
    return supabase.storage.from(AD_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setProgress(0);
    setMessage(null);
    setError(null);

    try {
      if (!title.trim()) throw new Error('Ad title is required.');
      if (!videoFile) throw new Error('Ad video is required.');
      if (!videoFile.type.startsWith('video/')) throw new Error('Please choose a valid ad video file.');
      if (runtimeSeconds <= 0 || runtimeSeconds > 180) throw new Error('Ad video must be 1–180 seconds.');
      let parsedClick: URL;
      try {
        parsedClick = new URL(clickUrl);
      } catch {
        throw new Error('Please enter a valid destination link URL.');
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired. Please sign in again.');

      const basePath = `admin/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const videoPath = `${basePath}.${fileExt(videoFile.name, 'mp4')}`;
      await uploadResumableToSupabase({
        file: videoFile,
        bucket: AD_BUCKET,
        objectPath: videoPath,
        accessToken: session.access_token,
        onProgress: setProgress,
      });
      const videoPublic = supabase.storage.from(AD_BUCKET).getPublicUrl(videoPath).data.publicUrl;
      const logoPublic = await uploadImage(logoFile, basePath, 'Logo');
      const bannerPublic = await uploadImage(bannerFile, basePath, 'Banner');

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          video_url: videoPublic,
          click_url: parsedClick.toString(),
          thumbnail_url: logoPublic,
          logo_url: logoPublic,
          banner_url: bannerPublic,
          runtime_seconds: runtimeSeconds,
          skippable,
          approved,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
          is_active: active,
        }),
      });

      if (!res.ok) throw new Error(await parseApiError(res));
      setMessage('Ad uploaded and saved.');
      setTitle('');
      setClickUrl('');
      setVideoFile(null);
      setLogoFile(null);
      setBannerFile(null);
      setRuntimeSeconds(0);
      setStartsAt('');
      setEndsAt('');
      setSkippable(true);
      setApproved(true);
      setActive(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  }

  return (
    <section className="grid gap-6 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 xl:grid-cols-[minmax(0,440px)_1fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white">Upload a new ad</h2>
          <p className="mt-1 text-sm text-zinc-400">Add the video, optional logo, optional banner, and preview both placements while you work.</p>
        </div>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ad title" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        <input value={clickUrl} onChange={(event) => setClickUrl(event.target.value)} placeholder="Destination URL (https://...)" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        <label className="block rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300">
          <span className="mb-2 flex items-center gap-2 font-black text-white"><UploadCloud className="h-4 w-4" /> Ad video</span>
          <input type="file" accept="video/*" required onChange={(event) => void onVideoChange(event.target.files?.[0] || null)} className="block w-full text-sm" />
          {runtimeSeconds ? <span className="mt-2 block text-xs text-zinc-500">Runtime: {runtimeSeconds}s</span> : null}
        </label>
        <label className="block rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300">
          <span className="mb-2 flex items-center gap-2 font-black text-white"><ImagePlus className="h-4 w-4" /> Logo image (optional)</span>
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
          <span className="mt-2 block text-xs text-zinc-500">If omitted, ViewTube will not show a fake logo or “Ad” avatar.</span>
        </label>
        <label className="block rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300">
          <span className="mb-2 flex items-center gap-2 font-black text-white"><ImagePlus className="h-4 w-4" /> Sidebar banner (optional)</span>
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => setBannerFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
          <span className="mt-2 block text-xs text-zinc-500">If omitted, the companion card starts directly with the title row.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
          <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        </div>
        <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={skippable} onChange={(event) => setSkippable(event.target.checked)} /> Skippable</label>
          <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /> Approved</label>
          <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
        </div>
        {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}
        <button disabled={submitting} className="h-12 w-full rounded-full bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-60">
          {submitting ? `Uploading… ${Math.round(progress)}%` : 'Upload ad'}
        </button>
      </form>

      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">In-video preview</div>
          <InVideoPreview title={previewAd.title} clickUrl={previewAd.click_url} videoUrl={videoPreviewUrl} logoUrl={logoPreviewUrl} />
        </div>
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Above recommended preview</div>
          <AdCompanionCard ad={previewAd} preview />
        </div>
      </div>
    </section>
  );
}
