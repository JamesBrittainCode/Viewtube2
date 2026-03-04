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
  runtime_seconds: number;
  target_reach?: number | null;
  calculated_price_usd?: number | null;
  skippable: boolean;
  approved: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  source_submission_id?: string | null;
  created_at: string;
};

type AdSubmission = {
  id: string;
  first_name: string;
  last_name: string;
  position_title: string;
  company_name: string;
  contact_email: string;
  ad_title: string;
  click_url: string;
  video_url: string;
  thumbnail_url?: string | null;
  runtime_seconds: number;
  target_reach?: number | null;
  calculated_price_usd?: number | null;
  skippable: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  paypal_transaction_id: string;
  payment_amount_usd?: number | null;
  status: 'pending' | 'approved_pending_payment' | 'paid_pending_launch' | 'approved' | 'rejected';
  review_notes?: string | null;
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

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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
  const [adApproved, setAdApproved] = useState(true);
  const [adStartsAt, setAdStartsAt] = useState('');
  const [adEndsAt, setAdEndsAt] = useState('');
  const [adVideoFile, setAdVideoFile] = useState<File | null>(null);
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [submissions, setSubmissions] = useState<AdSubmission[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adSubmitting, setAdSubmitting] = useState(false);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [adError, setAdError] = useState<string | null>(null);
  const [adMessage, setAdMessage] = useState<string | null>(null);
  const [submissionActionLoading, setSubmissionActionLoading] = useState<string | null>(null);
  const [submissionNote, setSubmissionNote] = useState<Record<string, string>>({});
  const [submissionStart, setSubmissionStart] = useState<Record<string, string>>({});
  const [submissionEnd, setSubmissionEnd] = useState<Record<string, string>>({});
  const [adScheduleStart, setAdScheduleStart] = useState<Record<string, string>>({});
  const [adScheduleEnd, setAdScheduleEnd] = useState<Record<string, string>>({});
  const [previewSubmissionId, setPreviewSubmissionId] = useState<string | null>(null);
  const [previewAdId, setPreviewAdId] = useState<string | null>(null);

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
    async function loadAdData() {
      setAdsLoading(true);
      setAdError(null);
      try {
        const [adsRes, submissionsRes] = await Promise.all([
          fetch('/api/admin/ads', { cache: 'no-store' }),
          fetch('/api/admin/ad-submissions', { cache: 'no-store' }),
        ]);
        if (!adsRes.ok) throw new Error(await parseApiError(adsRes));
        if (!submissionsRes.ok) throw new Error(await parseApiError(submissionsRes));
        const adsData = (await adsRes.json()) as { ads?: AdItem[] };
        const submissionsData = (await submissionsRes.json()) as { submissions?: AdSubmission[] };
        setAds(adsData.ads || []);
        setSubmissions(submissionsData.submissions || []);
      } catch (err) {
        setAdError((err as Error).message);
      } finally {
        setAdsLoading(false);
      }
    }

    void loadAdData();
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

      if (!res.ok) throw new Error(await parseApiError(res));
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

      if (!res.ok) throw new Error(await parseApiError(res));
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

      if (!res.ok) throw new Error(await parseApiError(res));
      setVerifyMessage('Verification status updated.');
      router.refresh();
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function onUpdateAd(item: AdItem, patch: Partial<AdItem>) {
    setAdError(null);
    setAdMessage(null);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          ...patch,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { ad?: AdItem };
      if (data.ad) {
        setAds((prev) => prev.map((ad) => (ad.id === item.id ? data.ad! : ad)));
      }
      setAdMessage('Ad updated.');
    } catch (err) {
      setAdError((err as Error).message);
    }
  }

  async function onSubmissionAction(
    submission: AdSubmission,
    action: 'approve' | 'reject' | 'launch_paid',
  ) {
    setSubmissionActionLoading(submission.id);
    setAdError(null);
    setAdMessage(null);

    try {
      const res = await fetch('/api/admin/ad-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submission.id,
          action,
          review_notes: submissionNote[submission.id] || '',
          starts_at: submissionStart[submission.id] || submission.starts_at || null,
          ends_at: submissionEnd[submission.id] || submission.ends_at || null,
          force_active: true,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      const payload = (await res.json()) as { submission?: AdSubmission; ad?: AdItem };
      if (payload.submission) {
        setSubmissions((prev) => prev.map((row) => (row.id === submission.id ? { ...row, ...payload.submission! } : row)));
      }
      if (payload.ad) {
        setAds((prev) => [payload.ad!, ...prev]);
      }
      if (action === 'approve') {
        setAdMessage('Submission approved. Waiting for advertiser payment.');
      } else if (action === 'launch_paid') {
        setAdMessage('Paid submission launched.');
      } else {
        setAdMessage('Submission rejected.');
      }
    } catch (err) {
      setAdError((err as Error).message);
    } finally {
      setSubmissionActionLoading(null);
    }
  }

  async function onDeleteSubmission(submissionId: string) {
    const confirmed = window.confirm('Delete this advertiser submission permanently?');
    if (!confirmed) return;
    setSubmissionActionLoading(submissionId);
    setAdError(null);
    setAdMessage(null);
    try {
      const res = await fetch(`/api/admin/ad-submissions?id=${encodeURIComponent(submissionId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setSubmissions((prev) => prev.filter((item) => item.id !== submissionId));
      setAdMessage('Submission deleted.');
    } catch (err) {
      setAdError((err as Error).message);
    } finally {
      setSubmissionActionLoading(null);
    }
  }

  async function onDeleteAd(adId: string) {
    const confirmed = window.confirm('Delete this ad campaign permanently?');
    if (!confirmed) return;
    setAdError(null);
    setAdMessage(null);
    try {
      const res = await fetch(`/api/admin/ads?id=${encodeURIComponent(adId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setAds((prev) => prev.filter((item) => item.id !== adId));
      setAdMessage('Ad campaign deleted.');
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
      if (adImageFile && !['image/png', 'image/jpeg'].includes(adImageFile.type)) {
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
        const { error: imageUploadError } = await supabase.storage.from(AD_BUCKET).upload(imagePath, adImageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: adImageFile.type || 'image/jpeg',
        });
        if (imageUploadError) throw new Error(imageUploadError.message);
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
          runtime_seconds: Math.round(adDurationSeconds),
          skippable: adSkippable,
          approved: adApproved,
          starts_at: adStartsAt || null,
          ends_at: adEndsAt || null,
          is_active: adActive,
        }),
      });

      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { ad?: AdItem };
      if (data.ad) setAds((prev) => [data.ad!, ...prev]);

      setAdTitle('');
      setAdClickUrl('');
      setAdVideoFile(null);
      setAdImageFile(null);
      setAdSkippable(true);
      setAdActive(true);
      setAdApproved(true);
      setAdStartsAt('');
      setAdEndsAt('');
      setAdMessage('Ad uploaded and saved.');
    } catch (err) {
      setAdError((err as Error).message);
    } finally {
      setAdSubmitting(false);
      setAdUploadProgress(0);
    }
  }

  const pendingSubmissions = submissions.filter((item) => item.status === 'pending');
  const waitingPayment = submissions.filter((item) => item.status === 'approved_pending_payment');
  const readyToLaunch = submissions.filter((item) => item.status === 'paid_pending_launch');

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
          <input value={countHandle} onChange={(event) => setCountHandle(event.target.value)} placeholder="@target_handle" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
          <input type="number" min={0} value={subscribersCount} onChange={(event) => setSubscribersCount(Number(event.target.value) || 0)} placeholder="Subscriber count" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
          {countError && <p className="text-sm text-red-400">{countError}</p>}
          {countMessage && <p className="text-sm text-green-400">{countMessage}</p>}
          <button type="submit" disabled={countLoading} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60">{countLoading ? 'Updating...' : 'Save subscriber count'}</button>
        </form>
      )}

      {activeTab === 'verification' && (
        <form onSubmit={onVerifySubmit} className="mt-5 space-y-3 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Channel Verification</h3>
          <input value={verifyHandle} onChange={(event) => setVerifyHandle(event.target.value)} placeholder="@target_handle" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
            Verified channel
          </label>
          {verifyError && <p className="text-sm text-red-400">{verifyError}</p>}
          {verifyMessage && <p className="text-sm text-green-400">{verifyMessage}</p>}
          <button type="submit" disabled={verifyLoading} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60">{verifyLoading ? 'Updating...' : 'Save verification status'}</button>
        </form>
      )}

      {activeTab === 'suspension' && (
        <form onSubmit={onSuspendSubmit} className="mt-5 space-y-3 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Account Suspension</h3>
          <input value={suspendHandle} onChange={(event) => setSuspendHandle(event.target.value)} placeholder="@target_handle" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={suspended} onChange={(event) => setSuspended(event.target.checked)} />
            Suspended
          </label>
          {suspendError && <p className="text-sm text-red-400">{suspendError}</p>}
          {suspendMessage && <p className="text-sm text-green-400">{suspendMessage}</p>}
          <button type="submit" disabled={suspendLoading} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60">{suspendLoading ? 'Updating...' : 'Save suspension status'}</button>
        </form>
      )}

      {activeTab === 'ads' && (
        <div className="mt-5 space-y-4">
          <form onSubmit={onAdSubmit} className="space-y-3 rounded-xl border border-zinc-700 p-4">
            <h3 className="text-sm font-semibold">Upload and Schedule Ad</h3>
            <input value={adTitle} onChange={(event) => setAdTitle(event.target.value)} placeholder="Ad title" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
            <input value={adClickUrl} onChange={(event) => setAdClickUrl(event.target.value)} placeholder="https://example.com" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="datetime-local" value={adStartsAt} onChange={(event) => setAdStartsAt(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
              <input type="datetime-local" value={adEndsAt} onChange={(event) => setAdEndsAt(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
            </div>
            <label className="block text-sm text-zinc-400">Ad video</label>
            <input type="file" accept="video/*" required onChange={(event) => setAdVideoFile(event.target.files?.[0] || null)} className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-zinc-900" />
            <label className="block text-sm text-zinc-400">Link image (optional PNG/JPEG)</label>
            <input type="file" accept="image/png,image/jpeg" onChange={(event) => setAdImageFile(event.target.files?.[0] || null)} className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-zinc-900" />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input type="checkbox" checked={adSkippable} onChange={(event) => setAdSkippable(event.target.checked)} />
                Skippable
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input type="checkbox" checked={adApproved} onChange={(event) => setAdApproved(event.target.checked)} />
                Approved
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input type="checkbox" checked={adActive} onChange={(event) => setAdActive(event.target.checked)} />
                Active
              </label>
            </div>
            {adError && <p className="text-sm text-red-400">{adError}</p>}
            {adMessage && <p className="text-sm text-green-400">{adMessage}</p>}
            {adSubmitting && adUploadProgress > 0 && <p className="text-sm text-zinc-400">Uploading ad video: {adUploadProgress}%</p>}
            <button type="submit" disabled={adSubmitting} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60">{adSubmitting ? 'Uploading...' : 'Save ad'}</button>
          </form>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Pending advertiser submissions</h4>
            {adsLoading ? <p className="mt-2 text-sm text-zinc-400">Loading submissions...</p> : null}
            {!adsLoading && !pendingSubmissions.length ? <p className="mt-2 text-sm text-zinc-400">No pending submissions.</p> : null}
            <div className="mt-3 space-y-3">
              {pendingSubmissions.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <p className="text-sm font-semibold">{item.ad_title}</p>
                  <p className="text-xs text-zinc-400">
                    {item.first_name} {item.last_name} • {item.position_title} • {item.company_name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.contact_email} • PayPal TX: {item.paypal_transaction_id}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Runtime: {item.runtime_seconds}s • {item.skippable ? 'Skippable' : 'Non-skippable'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Reach: {(item.target_reach || 0).toLocaleString()} • Price: $
                    {Number(item.calculated_price_usd || 0).toFixed(2)}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={submissionStart[item.id] ?? toLocalDateTimeInput(item.starts_at)}
                      onChange={(event) => setSubmissionStart((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs"
                    />
                    <input
                      type="datetime-local"
                      value={submissionEnd[item.id] ?? toLocalDateTimeInput(item.ends_at)}
                      onChange={(event) => setSubmissionEnd((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={submissionNote[item.id] || ''}
                    onChange={(event) => setSubmissionNote((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder="Review notes"
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewSubmissionId((current) => (current === item.id ? null : item.id))
                      }
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                    >
                      {previewSubmissionId === item.id ? 'Hide Preview' : 'Preview Ad'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSubmissionAction(item, 'approve')}
                      disabled={submissionActionLoading === item.id}
                      className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                    >
                      Approve (Request Payment)
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSubmissionAction(item, 'reject')}
                      disabled={submissionActionLoading === item.id}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteSubmission(item.id)}
                      disabled={submissionActionLoading === item.id}
                      className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                    >
                      Delete Submission
                    </button>
                  </div>
                  {previewSubmissionId === item.id && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-black">
                      <video
                        src={item.video_url}
                        controls
                        preload="metadata"
                        className="aspect-video w-full"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Approved, waiting for payment</h4>
            {!waitingPayment.length ? (
              <p className="mt-2 text-sm text-zinc-400">No submissions awaiting payment.</p>
            ) : null}
            <div className="mt-3 space-y-3">
              {waitingPayment.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <p className="text-sm font-semibold">{item.ad_title}</p>
                  <p className="text-xs text-zinc-500">
                    {item.first_name} {item.last_name} • {item.company_name}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Budget: ${Number(item.calculated_price_usd || 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Paid, ready to launch</h4>
            {!readyToLaunch.length ? (
              <p className="mt-2 text-sm text-zinc-400">No paid submissions waiting for launch.</p>
            ) : null}
            <div className="mt-3 space-y-3">
              {readyToLaunch.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <p className="text-sm font-semibold">{item.ad_title}</p>
                  <p className="text-xs text-zinc-500">
                    TX: {item.paypal_transaction_id || 'N/A'} • Amount: $
                    {Number(item.payment_amount_usd || 0).toFixed(2)}
                  </p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => void onSubmissionAction(item, 'launch_paid')}
                      disabled={submissionActionLoading === item.id}
                      className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                    >
                      Launch Campaign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Existing ads</h4>
            {adsLoading ? <p className="mt-2 text-sm text-zinc-400">Loading ads...</p> : null}
            {!adsLoading && !ads.length ? <p className="mt-2 text-sm text-zinc-400">No ads uploaded yet.</p> : null}
            <div className="mt-3 space-y-2">
              {ads.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">Runtime: {item.runtime_seconds || 0}s</p>
                      <p className="text-xs text-zinc-500">
                        Reach: {(item.target_reach || 0).toLocaleString()} • Price: $
                        {Number(item.calculated_price_usd || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void onUpdateAd(item, { is_active: !item.is_active })}
                        className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                      >
                        {item.is_active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onUpdateAd(item, { approved: !item.approved })}
                        className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                      >
                        {item.approved ? 'Unapprove' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteAd(item.id)}
                        className="rounded-full border border-red-700 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40"
                      >
                        Delete Campaign
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={adScheduleStart[item.id] ?? toLocalDateTimeInput(item.starts_at)}
                      onChange={(event) => setAdScheduleStart((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs"
                    />
                    <input
                      type="datetime-local"
                      value={adScheduleEnd[item.id] ?? toLocalDateTimeInput(item.ends_at)}
                      onChange={(event) => setAdScheduleEnd((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs"
                    />
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewAdId((current) => (current === item.id ? null : item.id))
                      }
                      className="mr-2 rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                    >
                      {previewAdId === item.id ? 'Hide Preview' : 'Preview Ad'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateAd(item, {
                          starts_at: adScheduleStart[item.id] || null,
                          ends_at: adScheduleEnd[item.id] || null,
                        })
                      }
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                    >
                      Save Schedule
                    </button>
                  </div>
                  {previewAdId === item.id && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-black">
                      <video
                        src={item.video_url}
                        controls
                        preload="metadata"
                        className="aspect-video w-full"
                      />
                    </div>
                  )}
                  <p className="mt-2 text-xs text-zinc-400">
                    {item.skippable ? 'Skippable' : 'Non-skippable'} •{' '}
                    {item.approved ? 'Approved' : 'Pending approval'} •{' '}
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
