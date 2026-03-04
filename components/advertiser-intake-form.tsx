'use client';

import { FormEvent, useState } from 'react';
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
  const paypalCheckoutUrl = process.env.NEXT_PUBLIC_PAYPAL_CHECKOUT_URL || '';

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [runtimeLabel, setRuntimeLabel] = useState<string | null>(null);
  const [runtimeSeconds, setRuntimeSeconds] = useState(0);

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

    try {
      if (!videoFile) throw new Error('Please upload your ad video.');
      if (!videoFile.type.startsWith('video/')) {
        throw new Error('Please choose a valid ad video file.');
      }
      if (runtimeSeconds <= 0 || runtimeSeconds > 180) {
        throw new Error('Ad runtime must be between 1 and 180 seconds.');
      }
      if (thumbnailFile && !ALLOWED_IMAGE_TYPES.has(thumbnailFile.type)) {
        throw new Error('Thumbnail image must be PNG or JPEG.');
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

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        const thumbPath = `${basePath}-thumb.${fileExt(thumbnailFile.name, 'jpg')}`;
        const { error: thumbError } = await supabase.storage
          .from(AD_SUBMISSIONS_BUCKET)
          .upload(thumbPath, thumbnailFile, {
            upsert: false,
            contentType: thumbnailFile.type || 'image/jpeg',
            cacheControl: '3600',
          });
        if (thumbError) throw new Error(thumbError.message);
        thumbnailUrl = supabase.storage
          .from(AD_SUBMISSIONS_BUCKET)
          .getPublicUrl(thumbPath).data.publicUrl;
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
        thumbnail_url: thumbnailUrl,
        runtime_seconds: runtimeSeconds,
        skippable: formData.get('skippable') === 'on',
        starts_at: String(formData.get('starts_at') || '').trim() || null,
        ends_at: String(formData.get('ends_at') || '').trim() || null,
        paypal_transaction_id: String(formData.get('paypal_transaction_id') || '').trim(),
        payment_amount_usd: Number(formData.get('payment_amount_usd') || 0),
      };

      const res = await fetch('/api/advertise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setMessage('Ad campaign submitted. Our team will review and approve before publishing.');
      form.reset();
      setVideoFile(null);
      setThumbnailFile(null);
      setRuntimeLabel(null);
      setRuntimeSeconds(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-semibold">Advertiser Campaign Intake</h2>
        <p className="text-sm text-zinc-500">
          Submit your campaign and payment details. All ads are manually reviewed before going live.
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
            <span className="mb-2 block text-zinc-500">Thumbnail image (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
          </label>
          <input name="starts_at" type="datetime-local" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <input name="ends_at" type="datetime-local" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <label className="flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-3 text-sm dark:border-zinc-700 sm:col-span-2">
            <input name="skippable" type="checkbox" defaultChecked />
            Allow skip button
          </label>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h3 className="text-base font-semibold">Payment (PayPal)</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Complete payment first, then submit the PayPal transaction ID below for verification.
          </p>
          {paypalCheckoutUrl ? (
            <a
              href={paypalCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Pay with PayPal
            </a>
          ) : (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              PayPal checkout URL is not configured yet. Ask ViewTube admin to set `NEXT_PUBLIC_PAYPAL_CHECKOUT_URL`.
            </p>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="paypal_transaction_id" placeholder="PayPal transaction ID" required className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
            <input name="payment_amount_usd" type="number" step="0.01" min="0" placeholder="Payment amount (USD)" className="h-11 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
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
