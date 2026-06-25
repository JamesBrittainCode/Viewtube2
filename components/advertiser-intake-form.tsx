'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateAdPricing } from '@/lib/ad-pricing';
import { AD_SUBMISSIONS_BUCKET } from '@/lib/constants';
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
    return parsed.error || 'Submission failed';
  } catch {
    return text || 'Submission failed';
  }
}

export function AdvertiserIntakeForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [runtimeLabel, setRuntimeLabel] = useState<string | null>(null);
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);
  const [targetReach, setTargetReach] = useState(10000);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [skippable, setSkippable] = useState(true);

  async function onVideoChange(file: File | null) {
    setVideoFile(file);
    setError(null);
    setRuntimeLabel(null);
    setRuntimeSeconds(0);

    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please choose a valid ad video file.');
      return;
    }

    const duration = Math.round(await getVideoDurationSeconds(file));
    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Could not determine ad runtime.');
      return;
    }
    if (duration > 180) {
      setError('Ad runtime must be 180 seconds (3 minutes) or less.');
      return;
    }
    setRuntimeSeconds(duration);
    setRuntimeLabel(`${duration}s`);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setProgress(0);
    setError(null);
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const pricing = calculateAdPricing({
      runtimeSeconds: Math.max(1, runtimeSeconds || 1),
      targetReach,
      skippable,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    });

    try {
      if (!videoFile) throw new Error('Please upload your ad video.');
      if (!videoFile.type.startsWith('video/')) {
        throw new Error('Please choose a valid ad video file.');
      }
      if (runtimeSeconds <= 0 || runtimeSeconds > 180) {
        throw new Error('Ad runtime must be between 1 and 180 seconds.');
      }
      if (logoFile && !ALLOWED_IMAGE_TYPES.has(logoFile.type)) {
        throw new Error('Logo image must be PNG or JPEG.');
      }
      if (bannerFile && !ALLOWED_IMAGE_TYPES.has(bannerFile.type)) {
        throw new Error('Banner image must be PNG or JPEG.');
      }

      const clickUrl = String(formData.get('click_url') || '').trim();
      try {
        new URL(clickUrl);
      } catch {
        throw new Error('Please enter a valid destination link URL.');
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!accessToken) {
        throw new Error('Unable to authorize upload. Try refreshing the page.');
      }

      const basePath = `incoming/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const videoPath = `${basePath}.${fileExt(videoFile.name, 'mp4')}`;
      await uploadResumableToSupabase({
        file: videoFile,
        bucket: AD_SUBMISSIONS_BUCKET,
        objectPath: videoPath,
        accessToken,
        onProgress: setProgress,
      });
      const videoUrl = supabase.storage
        .from(AD_SUBMISSIONS_BUCKET)
        .getPublicUrl(videoPath).data.publicUrl;

      let logoUrl: string | null = null;
      if (logoFile) {
        const logoPath = `${basePath}-logo.${fileExt(logoFile.name, 'jpg')}`;
        const { error: logoError } = await supabase.storage
          .from(AD_SUBMISSIONS_BUCKET)
          .upload(logoPath, logoFile, {
            upsert: false,
            contentType: logoFile.type || 'image/jpeg',
            cacheControl: '3600',
          });
        if (logoError) throw new Error(logoError.message);
        logoUrl = supabase.storage
          .from(AD_SUBMISSIONS_BUCKET)
          .getPublicUrl(logoPath).data.publicUrl;
      }

      let bannerUrl: string | null = null;
      if (bannerFile) {
        const bannerPath = `${basePath}-banner.${fileExt(bannerFile.name, 'jpg')}`;
        const { error: bannerError } = await supabase.storage
          .from(AD_SUBMISSIONS_BUCKET)
          .upload(bannerPath, bannerFile, {
            upsert: false,
            contentType: bannerFile.type || 'image/jpeg',
            cacheControl: '3600',
          });
        if (bannerError) throw new Error(bannerError.message);
        bannerUrl = supabase.storage
          .from(AD_SUBMISSIONS_BUCKET)
          .getPublicUrl(bannerPath).data.publicUrl;
      }

      const payload = {
        first_name: String(formData.get('first_name') || '').trim(),
        last_name: String(formData.get('last_name') || '').trim(),
        position_title: String(formData.get('position_title') || '').trim(),
        company_name: String(formData.get('company_name') || '').trim(),
        contact_email: String(formData.get('contact_email') || '').trim(),
        ad_title: String(formData.get('ad_title') || '').trim(),
        click_url: clickUrl,
        video_url: videoUrl,
        thumbnail_url: logoUrl,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        runtime_seconds: runtimeSeconds,
        target_reach: pricing.targetReach,
        skippable,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      };

      const res = await fetch('/api/advertise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setMessage('Ad campaign submitted for review.');
      form.reset();
      setVideoFile(null);
      setLogoFile(null);
      setBannerFile(null);
      setRuntimeLabel(null);
      setRuntimeSeconds(0);
      setTargetReach(10000);
      setStartsAt('');
      setEndsAt('');
      setSkippable(true);
      router.push('/advertise/portal?submitted=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  const pricing = calculateAdPricing({
    runtimeSeconds: Math.max(1, runtimeSeconds || 1),
    targetReach,
    skippable,
    startsAt: startsAt || null,
    endsAt: endsAt || null,
  });

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold">Advertiser Campaign Intake</h2>
        <p className="text-sm text-zinc-500">
          Submit your campaign details. Ads are manually reviewed first, then paid through Fourthwall checkout.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <input name="first_name" placeholder="First name" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input name="last_name" placeholder="Last name" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input name="position_title" placeholder="Position in company" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input name="company_name" placeholder="Company name" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input name="contact_email" type="email" placeholder="Work email" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <input name="ad_title" placeholder="Ad title" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2" />
          <input name="click_url" placeholder="Destination URL (https://...)" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2" />
          <label className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700">
            <span className="mb-2 block text-zinc-500">Ad video (max 3 minutes)</span>
            <input
              type="file"
              accept="video/*"
              required
              onChange={(event) => void onVideoChange(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
            {runtimeLabel ? <p className="mt-2 text-xs text-zinc-500">Detected runtime: {runtimeLabel}</p> : null}
          </label>
          <label className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700">
            <span className="mb-2 block text-zinc-500">Logo image (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
            <p className="mt-2 text-xs text-zinc-500">Shown as the small round sponsor logo. No placeholder appears if omitted.</p>
          </label>
          <label className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700">
            <span className="mb-2 block text-zinc-500">Sidebar banner (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setBannerFile(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
            <p className="mt-2 text-xs text-zinc-500">Shown above recommended videos only when uploaded.</p>
          </label>
          <input
            name="target_reach"
            type="number"
            min="100"
            step="100"
            value={targetReach}
            onChange={(event) => setTargetReach(Math.max(100, Number(event.target.value) || 100))}
            placeholder="Target reach (people)"
            className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <p className="text-xs text-zinc-500">Estimated campaign days</p>
            <p className="font-semibold">{pricing.campaignDays} days</p>
          </div>
          <input
            name="starts_at"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="ends_at"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <label className="flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-3 text-sm dark:border-zinc-700 sm:col-span-2">
            <input
              name="skippable"
              type="checkbox"
              checked={skippable}
              onChange={(event) => setSkippable(event.target.checked)}
            />
            Allow skip button
          </label>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h3 className="text-base font-semibold">Budget Estimate</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Budget is auto-calculated from ad runtime, target reach, campaign length, and skip mode.
          </p>
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500">Required campaign budget</p>
            <p className="text-xl font-bold">${pricing.estimatedPriceUsd.toFixed(2)} USD</p>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Payment happens only after your campaign is approved.
          </p>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        {message ? <p className="text-sm text-green-600 dark:text-green-400">{message}</p> : null}
        {loading && progress > 0 ? <p className="text-sm text-zinc-500">Uploading ad video: {progress}%</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? 'Submitting...' : 'Submit for Approval'}
        </button>
      </form>
    </section>
  );
}
