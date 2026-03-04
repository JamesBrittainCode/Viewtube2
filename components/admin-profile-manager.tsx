'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeHandle } from '@/lib/handle';
import { AD_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { uploadResumableToSupabase } from '@/lib/supabase/resumable-upload';

type AdminTab = 'subscribers' | 'verification' | 'suspension' | 'ads';

type AdItem = {
  id: string;
  title: string;
  video_url: string;
  click_url: string;
  thumbnail_url?: string | null;
  skippable: boolean;
  is_active: boolean;
  created_at: string;
};

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Request failed';
  } catch {
    return text || 'Request failed';
  }
}

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
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration || 0);
      video.onerror = () => reject(new Error('Could not read ad video metadata.'));
    });
    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AdminProfileManager() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('subscribers');

  const [countHandle, setCountHandle] = useState('@');
  const [verifyHandle, setVerifyHandle] = useState('@');
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [suspendHandle, setSuspendHandle] = useState('@');
  const [suspended, setSuspended] = useState(true);
  const [countLoading, setCountLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [countMessage, setCountMessage] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [suspendMessage, setSuspendMessage] = useState<string | null>(null);

  const [adTitle, setAdTitle] = useState('');
  const [adClickUrl, setAdClickUrl] = useState('');
  const [adSkippable, setAdSkippable] = useState(true);
  const [adActive, setAdActive] = useState(true);
  const [adVideoFile, setAdVideoFile] = useState<File | null>(null);
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adSubmitting, setAdSubmitting] = useState(false);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [adError, setAdError] = useState<string | null>(null);
  const [adMessage, setAdMessage] = useState<string | null>(null);

  const tabs: { id: AdminTab; label: string }[] = useMemo(
    () => [
      { id: 'subscribers', label: 'Subscriber Count' },
      { id: 'verification', label: 'Verification' },
      { id: 'suspension', label: 'Suspension' },
      { id: 'ads', label: 'Ads' },
    ],
    [],
  );

  useEffect(() => {
    async function loadAds() {
      setAdsLoading(true);
      try {
        const res = await fetch('/api/admin/ads', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(await parseApiError(res));
        }
        const data = (await res.json()) as { ads?: AdItem[] };
        setAds(data.ads || []);
      } catch (err) {
        setAdError((err as Error).message);
      } finally {
        setAdsLoading(false);
      }
    }

    void loadAds();
  }, []);

  async function onCountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCountLoading(true);
    setCountError(null);
    setCountMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: normalizeHandle(countHandle),
          subscribers_count: subscribersCount,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setCountMessage('Subscriber count updated.');
      router.refresh();
    } catch (err) {
      setCountError((err as Error).message);
    } finally {
      setCountLoading(false);
    }
  }

  async function onSuspendSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuspendLoading(true);
    setSuspendError(null);
    setSuspendMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: normalizeHandle(suspendHandle),
          suspended,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setSuspendMessage(suspended ? 'User suspended.' : 'User unsuspended.');
      router.refresh();
    } catch (err) {
      setSuspendError((err as Error).message);
    } finally {
      setSuspendLoading(false);
    }
  }

  async function onVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyMessage(null);

    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: normalizeHandle(verifyHandle),
          verified,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setVerifyMessage('Verification status updated.');
      router.refresh();
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function onToggleAdActive(id: string, nextActive: boolean) {
    setAdError(null);
    setAdMessage(null);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: nextActive }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      setAds((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_active: nextActive } : item)),
      );
      setAdMessage(nextActive ? 'Ad activated.' : 'Ad paused.');
    } catch (err) {
      setAdError((err as Error).message);
    }
  }

  async function onAdSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdSubmitting(true);
    setAdUploadProgress(0);
    setAdError(null);
    setAdMessage(null);

    try {
      if (!adVideoFile || !adVideoFile.type.startsWith('video/')) {
        throw new Error('Please choose a valid ad video file.');
      }
      const adDurationSeconds = await getVideoDurationSeconds(adVideoFile);
      if (!Number.isFinite(adDurationSeconds) || adDurationSeconds <= 0) {
        throw new Error('Could not determine ad video duration.');
      }
      if (adDurationSeconds > 180) {
        throw new Error('Ad video must be 3 minutes (180 seconds) or less.');
      }
      if (
        adImageFile &&
        !['image/png', 'image/jpeg'].includes(adImageFile.type)
      ) {
        throw new Error('Link image must be PNG or JPEG.');
      }

      let parsedClick: URL;
      try {
        parsedClick = new URL(adClickUrl);
      } catch {
        throw new Error('Please enter a valid destination link URL.');
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session expired. Please sign in again.');
      }
      const now = Date.now();
      const basePath = `admin/${now}-${Math.random().toString(36).slice(2, 10)}`;
      const videoPath = `${basePath}.${fileExt(adVideoFile.name, 'mp4')}`;

      await uploadResumableToSupabase({
        file: adVideoFile,
        bucket: AD_BUCKET,
        objectPath: videoPath,
        accessToken: session.access_token,
        onProgress: setAdUploadProgress,
      });

      const videoPublic = supabase.storage.from(AD_BUCKET).getPublicUrl(videoPath).data.publicUrl;

      let imagePublic: string | null = null;
      if (adImageFile) {
        const imagePath = `${basePath}-link.${fileExt(adImageFile.name, 'jpg')}`;
        const { error: imageUploadError } = await supabase.storage
          .from(AD_BUCKET)
          .upload(imagePath, adImageFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: adImageFile.type || 'image/jpeg',
          });

        if (imageUploadError) {
          throw new Error(imageUploadError.message);
        }

        imagePublic = supabase.storage.from(AD_BUCKET).getPublicUrl(imagePath).data.publicUrl;
      }

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: adTitle.trim(),
          video_url: videoPublic,
          click_url: parsedClick.toString(),
          thumbnail_url: imagePublic,
          skippable: adSkippable,
          is_active: adActive,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }

      const data = (await res.json()) as { ad?: AdItem };
      if (data.ad) {
        setAds((prev) => [data.ad as AdItem, ...prev]);
      }

      setAdTitle('');
      setAdClickUrl('');
      setAdVideoFile(null);
      setAdImageFile(null);
      setAdSkippable(true);
      setAdActive(true);
      setAdMessage('Ad uploaded and saved.');
    } catch (err) {
      setAdError((err as Error).message);
    } finally {
      setAdSubmitting(false);
      setAdUploadProgress(0);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold">Studio Admin</h2>
      <p className="mt-1 text-sm text-zinc-400">Admin-only controls. Target users by exact `@handle`.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-white text-zinc-900'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'subscribers' && (
        <form onSubmit={onCountSubmit} className="mt-5 space-y-3 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Subscriber Count</h3>
          <input
            value={countHandle}
            onChange={(event) => setCountHandle(event.target.value)}
            placeholder="@target_handle"
            required
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
          />
          <input
            type="number"
            min={0}
            value={subscribersCount}
            onChange={(event) => setSubscribersCount(Number(event.target.value) || 0)}
            placeholder="Subscriber count"
            required
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
          />
          {countError && <p className="text-sm text-red-400">{countError}</p>}
          {countMessage && <p className="text-sm text-green-400">{countMessage}</p>}
          <button
            type="submit"
            disabled={countLoading}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
          >
            {countLoading ? 'Updating...' : 'Save subscriber count'}
          </button>
        </form>
      )}

      {activeTab === 'verification' && (
        <form onSubmit={onVerifySubmit} className="mt-5 space-y-3 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Channel Verification</h3>
          <input
            value={verifyHandle}
            onChange={(event) => setVerifyHandle(event.target.value)}
            placeholder="@target_handle"
            required
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
            />
            Verified channel
          </label>
          {verifyError && <p className="text-sm text-red-400">{verifyError}</p>}
          {verifyMessage && <p className="text-sm text-green-400">{verifyMessage}</p>}
          <button
            type="submit"
            disabled={verifyLoading}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
          >
            {verifyLoading ? 'Updating...' : 'Save verification status'}
          </button>
        </form>
      )}

      {activeTab === 'suspension' && (
        <form onSubmit={onSuspendSubmit} className="mt-5 space-y-3 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Account Suspension</h3>
          <input
            value={suspendHandle}
            onChange={(event) => setSuspendHandle(event.target.value)}
            placeholder="@target_handle"
            required
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={suspended}
              onChange={(event) => setSuspended(event.target.checked)}
            />
            Suspended
          </label>
          {suspendError && <p className="text-sm text-red-400">{suspendError}</p>}
          {suspendMessage && <p className="text-sm text-green-400">{suspendMessage}</p>}
          <button
            type="submit"
            disabled={suspendLoading}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
          >
            {suspendLoading ? 'Updating...' : 'Save suspension status'}
          </button>
        </form>
      )}

      {activeTab === 'ads' && (
        <div className="mt-5 space-y-4">
          <form onSubmit={onAdSubmit} className="space-y-3 rounded-xl border border-zinc-700 p-4">
            <h3 className="text-sm font-semibold">Upload Ad</h3>
            <input
              value={adTitle}
              onChange={(event) => setAdTitle(event.target.value)}
              placeholder="Ad title"
              required
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
            />
            <input
              value={adClickUrl}
              onChange={(event) => setAdClickUrl(event.target.value)}
              placeholder="https://example.com"
              required
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
            />
            <label className="block text-sm text-zinc-400">Ad video</label>
            <input
              type="file"
              accept="video/*"
              required
              onChange={(event) => setAdVideoFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-zinc-900"
            />
            <label className="block text-sm text-zinc-400">Link image (optional PNG/JPEG)</label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setAdImageFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-zinc-900"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={adSkippable}
                  onChange={(event) => setAdSkippable(event.target.checked)}
                />
                Skippable
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={adActive}
                  onChange={(event) => setAdActive(event.target.checked)}
                />
                Active immediately
              </label>
            </div>
            {adError && <p className="text-sm text-red-400">{adError}</p>}
            {adMessage && <p className="text-sm text-green-400">{adMessage}</p>}
            {adSubmitting && adUploadProgress > 0 && (
              <p className="text-sm text-zinc-400">Uploading ad video: {adUploadProgress}%</p>
            )}
            <button
              type="submit"
              disabled={adSubmitting}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              {adSubmitting ? 'Uploading...' : 'Save ad'}
            </button>
          </form>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Existing ads</h4>
            {adsLoading ? <p className="mt-2 text-sm text-zinc-400">Loading ads...</p> : null}
            {!adsLoading && !ads.length ? (
              <p className="mt-2 text-sm text-zinc-400">No ads uploaded yet.</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {ads.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onToggleAdActive(item.id, !item.is_active)}
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                    >
                      {item.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    {item.skippable ? 'Skippable' : 'Non-skippable'} •{' '}
                    {item.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
