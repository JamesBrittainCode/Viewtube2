'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeHandle } from '@/lib/handle';
import { AD_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { uploadResumableToSupabase } from '@/lib/supabase/resumable-upload';

type AdminTab = 'subscribers' | 'verification' | 'suspension' | 'earn' | 'reported' | 'videos' | 'alert' | 'popup' | 'ads';

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
  impressions_count?: number | null;
  clicks_count?: number | null;
  completions_count?: number | null;
  last_served_at?: string | null;
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
  paypal_transaction_id?: string | null;
  payment_amount_usd?: number | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  status: 'pending' | 'approved_pending_payment' | 'paid_pending_launch' | 'approved' | 'rejected';
  review_notes?: string | null;
  created_at: string;
};

type EarnApplication = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  channel_focus: string;
  why_join: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  profile?: {
    username?: string | null;
    handle?: string | null;
    subscribers_count?: number | null;
  } | null;
};

type VideoReport = {
  id: string;
  video_id: string;
  reporter_id: string;
  reason: string;
  details: string;
  status: 'open' | 'acknowledged' | 'dismissed' | 'resolved_takedown';
  admin_note?: string | null;
  resolution_action?: string | null;
  resolved_at?: string | null;
  created_at: string;
  video?: {
    id: string;
    title: string;
    video_url: string;
    thumbnail_url?: string | null;
    is_removed?: boolean;
    removed_reason?: string | null;
  } | null;
  reporter?: {
    username?: string | null;
    handle?: string | null;
  } | null;
};

type AdminVideoItem = {
  id: string;
  user_id: string;
  title: string;
  thumbnail_url?: string | null;
  video_url: string;
  views: number;
  is_removed?: boolean;
  removed_reason?: string | null;
  removed_at?: string | null;
  created_at: string;
  profile?: {
    id: string;
    username?: string | null;
    handle?: string | null;
  } | null;
};

type CreatorAccessPreview = {
  id: string;
  username: string;
  handle: string;
  avatar_url?: string | null;
  verified: boolean;
  top_streamer?: boolean;
  can_stream_live: boolean;
  can_moderate: boolean;
  is_admin: boolean;
};

type SiteAlertItem = {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
};

type SitePopupItem = {
  id: string;
  message: string;
  is_active: boolean;
  expires_at?: string | null;
  sound_enabled?: boolean;
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

export function AdminProfileManager({ isAdmin = true }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>(isAdmin ? 'subscribers' : 'reported');

  const [countHandle, setCountHandle] = useState('@');
  const [verifyHandle, setVerifyHandle] = useState('@');
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [verified, setVerified] = useState(false);
  const [topStreamer, setTopStreamer] = useState(false);
  const [canStreamLive, setCanStreamLive] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
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
  const [creatorPreviewLoading, setCreatorPreviewLoading] = useState(false);
  const [creatorPreviewError, setCreatorPreviewError] = useState<string | null>(null);
  const [creatorPreview, setCreatorPreview] = useState<CreatorAccessPreview | null>(null);
  const [siteAlertMessage, setSiteAlertMessage] = useState('');
  const [siteAlertActive, setSiteAlertActive] = useState(true);
  const [siteAlerts, setSiteAlerts] = useState<SiteAlertItem[]>([]);
  const [siteAlertLoading, setSiteAlertLoading] = useState(false);
  const [siteAlertError, setSiteAlertError] = useState<string | null>(null);
  const [siteAlertNotice, setSiteAlertNotice] = useState<string | null>(null);

  const [sitePopupMessage, setSitePopupMessage] = useState('');
  const [sitePopupActive, setSitePopupActive] = useState(true);
  const [sitePopupDuration, setSitePopupDuration] = useState(60);
  const [sitePopupSound, setSitePopupSound] = useState(true);
  const [sitePopups, setSitePopups] = useState<SitePopupItem[]>([]);
  const [sitePopupLoading, setSitePopupLoading] = useState(false);
  const [sitePopupError, setSitePopupError] = useState<string | null>(null);
  const [sitePopupNotice, setSitePopupNotice] = useState<string | null>(null);
  const [adVideoFile, setAdVideoFile] = useState<File | null>(null);
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [submissions, setSubmissions] = useState<AdSubmission[]>([]);
  const [earnApplications, setEarnApplications] = useState<EarnApplication[]>([]);
  const [earnLoading, setEarnLoading] = useState(false);
  const [earnActionLoading, setEarnActionLoading] = useState<string | null>(null);
  const [earnNote, setEarnNote] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<VideoReport[]>([]);
  const [videos, setVideos] = useState<AdminVideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoActionLoading, setVideoActionLoading] = useState<string | null>(null);
  const [videoReason, setVideoReason] = useState<Record<string, string>>({});
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState<Record<string, string>>({});
  const [takedownMessage, setTakedownMessage] = useState<Record<string, string>>({});
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
    () =>
      isAdmin
        ? [
            { id: 'subscribers', label: 'Subscriber Count' },
            { id: 'verification', label: 'Creator Access' },
            { id: 'suspension', label: 'Suspension' },
            { id: 'earn', label: 'Earn Applications' },
            { id: 'reported', label: 'Reported' },
            { id: 'videos', label: 'Video Takedown' },
            { id: 'alert', label: 'Site Alert' },
            { id: 'popup', label: 'Site Popup' },
            { id: 'ads', label: 'Ads' },
          ]
        : [
            { id: 'reported', label: 'Reported' },
            { id: 'videos', label: 'Video Takedown' },
          ],
    [isAdmin],
  );

  useEffect(() => {
    async function loadAdminData() {
      setAdsLoading(true);
      setEarnLoading(true);
      setVideosLoading(true);
      setAdError(null);
      setVideoError(null);
      try {
        if (isAdmin) {
          const [adsRes, submissionsRes, earnRes, reportsRes, videosRes, siteAlertRes, sitePopupRes] = await Promise.all([
            fetch('/api/admin/ads', { cache: 'no-store' }),
            fetch('/api/admin/ad-submissions', { cache: 'no-store' }),
            fetch('/api/admin/earn-applications', { cache: 'no-store' }),
            fetch('/api/admin/video-reports', { cache: 'no-store' }),
            fetch('/api/admin/videos', { cache: 'no-store' }),
            fetch('/api/admin/site-alert', { cache: 'no-store' }),
            fetch('/api/admin/site-popup', { cache: 'no-store' }),
          ]);
          if (!adsRes.ok) throw new Error(await parseApiError(adsRes));
          if (!submissionsRes.ok) throw new Error(await parseApiError(submissionsRes));
          if (!earnRes.ok) throw new Error(await parseApiError(earnRes));
          if (!reportsRes.ok) throw new Error(await parseApiError(reportsRes));
          if (!videosRes.ok) throw new Error(await parseApiError(videosRes));
          if (!siteAlertRes.ok) throw new Error(await parseApiError(siteAlertRes));
          if (!sitePopupRes.ok) throw new Error(await parseApiError(sitePopupRes));
          const adsData = (await adsRes.json()) as { ads?: AdItem[] };
          const submissionsData = (await submissionsRes.json()) as { submissions?: AdSubmission[] };
          const earnData = (await earnRes.json()) as { applications?: EarnApplication[] };
          const reportData = (await reportsRes.json()) as { reports?: VideoReport[] };
          const videosData = (await videosRes.json()) as { videos?: AdminVideoItem[] };
          const siteAlertData = (await siteAlertRes.json()) as { alerts?: SiteAlertItem[] };
          const sitePopupData = (await sitePopupRes.json()) as { popups?: SitePopupItem[] };
          setAds(adsData.ads || []);
          setSubmissions(submissionsData.submissions || []);
          setEarnApplications(earnData.applications || []);
          setReports(reportData.reports || []);
          setVideos(videosData.videos || []);
          setSiteAlerts(siteAlertData.alerts || []);
          setSitePopups(sitePopupData.popups || []);
        } else {
          const [reportsRes, videosRes] = await Promise.all([
            fetch('/api/admin/video-reports', { cache: 'no-store' }),
            fetch('/api/admin/videos', { cache: 'no-store' }),
          ]);
          if (!reportsRes.ok) throw new Error(await parseApiError(reportsRes));
          if (!videosRes.ok) throw new Error(await parseApiError(videosRes));
          const reportData = (await reportsRes.json()) as { reports?: VideoReport[] };
          const videosData = (await videosRes.json()) as { videos?: AdminVideoItem[] };
          setReports(reportData.reports || []);
          setVideos(videosData.videos || []);
        }
      } catch (err) {
        setAdError((err as Error).message);
        setVideoError((err as Error).message);
      } finally {
        setAdsLoading(false);
        setEarnLoading(false);
        setVideosLoading(false);
      }
    }

    void loadAdminData();
  }, [isAdmin]);

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
          top_streamer: topStreamer,
          can_stream_live: canStreamLive,
          can_moderate: canModerate,
        }),
      });

      if (!res.ok) throw new Error(await parseApiError(res));
      setVerifyMessage('Verification status updated.');
      setCreatorPreview((prev) =>
        prev
          ? {
              ...prev,
              verified,
              top_streamer: topStreamer,
              can_stream_live: canStreamLive,
              can_moderate: canModerate,
            }
          : prev,
      );
      router.refresh();
    } catch (err) {
      setVerifyError((err as Error).message);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function onPublishSiteAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSiteAlertLoading(true);
    setSiteAlertError(null);
    setSiteAlertNotice(null);
    try {
      const res = await fetch('/api/admin/site-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: siteAlertMessage,
          is_active: siteAlertActive,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { alert?: SiteAlertItem };
      if (data.alert) {
        setSiteAlerts((prev) => [data.alert!, ...prev.map((row) => ({ ...row, is_active: false }))]);
        setSiteAlertMessage('');
      }
      setSiteAlertNotice(siteAlertActive ? 'Alert published.' : 'Alert saved (inactive).');
      router.refresh();
    } catch (err) {
      setSiteAlertError((err as Error).message);
    } finally {
      setSiteAlertLoading(false);
    }
  }

  async function onPublishSitePopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSitePopupLoading(true);
    setSitePopupError(null);
    setSitePopupNotice(null);
    try {
      const res = await fetch('/api/admin/site-popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: sitePopupMessage,
          is_active: sitePopupActive,
          duration_seconds: sitePopupDuration,
          sound_enabled: sitePopupSound,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { popup?: SitePopupItem };
      if (data.popup) {
        setSitePopups((prev) => [data.popup!, ...prev.map((row) => ({ ...row, is_active: false }))]);
        setSitePopupMessage('');
      }
      setSitePopupNotice(sitePopupActive ? 'Popup published.' : 'Popup saved (inactive).');
      router.refresh();
    } catch (err) {
      setSitePopupError((err as Error).message);
    } finally {
      setSitePopupLoading(false);
    }
  }

  async function onToggleSitePopup(item: SitePopupItem, isActive: boolean) {
    setSitePopupLoading(true);
    setSitePopupError(null);
    setSitePopupNotice(null);
    try {
      const res = await fetch('/api/admin/site-popup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: isActive }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const payload = (await res.json()) as { popup?: SitePopupItem };
      if (payload.popup) {
        setSitePopups((prev) =>
          prev.map((row) =>
            row.id === item.id ? payload.popup! : { ...row, is_active: isActive ? false : row.is_active },
          ),
        );
      }
      setSitePopupNotice(isActive ? 'Popup activated.' : 'Popup deactivated.');
      router.refresh();
    } catch (err) {
      setSitePopupError((err as Error).message);
    } finally {
      setSitePopupLoading(false);
    }
  }

  async function onToggleSiteAlert(item: SiteAlertItem, isActive: boolean) {
    setSiteAlertLoading(true);
    setSiteAlertError(null);
    setSiteAlertNotice(null);
    try {
      const res = await fetch('/api/admin/site-alert', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: isActive }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const payload = (await res.json()) as { alert?: SiteAlertItem };
      if (payload.alert) {
        setSiteAlerts((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? payload.alert!
              : { ...row, is_active: isActive ? false : row.is_active },
          ),
        );
      }
      setSiteAlertNotice(isActive ? 'Alert activated.' : 'Alert deactivated.');
      router.refresh();
    } catch (err) {
      setSiteAlertError((err as Error).message);
    } finally {
      setSiteAlertLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin || activeTab !== 'verification') return;
    const normalizedRaw = verifyHandle.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
    if (normalizedRaw.length < 3) {
      setCreatorPreview(null);
      setCreatorPreviewError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCreatorPreviewLoading(true);
      setCreatorPreviewError(null);
      try {
        const res = await fetch(`/api/admin/profile?handle=${encodeURIComponent(normalizeHandle(verifyHandle))}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = (await res.json()) as { profile?: CreatorAccessPreview };
        if (!data.profile) throw new Error('Profile not found');
        setCreatorPreview(data.profile);
        setVerified(Boolean(data.profile.verified));
        setTopStreamer(Boolean(data.profile.top_streamer));
        setCanStreamLive(Boolean(data.profile.can_stream_live));
        setCanModerate(Boolean(data.profile.can_moderate));
      } catch (err) {
        setCreatorPreview(null);
        setCreatorPreviewError((err as Error).message);
      } finally {
        setCreatorPreviewLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [verifyHandle, activeTab, isAdmin]);

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
        setAdMessage(
          submission.status === 'paid_pending_launch'
            ? 'Paid submission launched.'
            : 'Submission launched manually before payment.',
        );
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

  async function onEarnDecision(item: EarnApplication, status: 'approved' | 'rejected') {
    setEarnActionLoading(item.id);
    setAdError(null);
    setAdMessage(null);
    try {
      const res = await fetch('/api/admin/earn-applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status,
          admin_notes: earnNote[item.id] || '',
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { application?: EarnApplication };
      if (data.application) {
        setEarnApplications((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...data.application! } : row)));
      }
      setAdMessage(status === 'approved' ? 'Earn application approved.' : 'Earn application rejected.');
    } catch (err) {
      setAdError((err as Error).message);
    } finally {
      setEarnActionLoading(null);
    }
  }

  async function onReportAction(item: VideoReport, action: 'acknowledge' | 'dismiss' | 'takedown') {
    setReportActionLoading(item.id);
    setAdError(null);
    setAdMessage(null);
    try {
      const res = await fetch('/api/admin/video-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          action,
          admin_note: reportNote[item.id] || '',
          takedown_message: takedownMessage[item.id] || '',
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      setReports((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                status:
                  action === 'acknowledge'
                    ? 'acknowledged'
                    : action === 'dismiss'
                      ? 'dismissed'
                      : 'resolved_takedown',
                admin_note: reportNote[item.id] || row.admin_note || null,
                resolution_action: action,
                resolved_at: new Date().toISOString(),
                video:
                  action === 'takedown' && row.video
                    ? {
                        id: row.video.id,
                        title: row.video.title,
                        video_url: row.video.video_url,
                        thumbnail_url: row.video.thumbnail_url ?? null,
                        is_removed: true,
                        removed_reason:
                          (takedownMessage[item.id] || reportNote[item.id] || '').trim() ||
                          row.video.removed_reason ||
                          null,
                      }
                    : row.video,
              }
            : row,
        ),
      );
      setAdMessage(
        action === 'takedown'
          ? 'Video taken down and report resolved.'
          : action === 'dismiss'
            ? 'Report dismissed.'
            : 'Report acknowledged.',
      );
    } catch (err) {
      setAdError((err as Error).message);
    } finally {
      setReportActionLoading(null);
    }
  }

  async function onVideoAction(item: AdminVideoItem, action: 'takedown' | 'restore') {
    const reason = (videoReason[item.id] || '').trim();
    if (action === 'takedown' && !reason) {
      setVideoError('Reason is required before taking down a video.');
      setVideoMessage(null);
      return;
    }

    setVideoActionLoading(item.id);
    setVideoError(null);
    setVideoMessage(null);
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          action,
          reason,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      const nowIso = new Date().toISOString();
      setVideos((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_removed: action === 'takedown',
                removed_reason: action === 'takedown' ? reason : null,
                removed_at: action === 'takedown' ? nowIso : null,
              }
            : row,
        ),
      );
      setVideoMessage(action === 'takedown' ? 'Video taken down and creator notified.' : 'Video restored.');
    } catch (err) {
      setVideoError((err as Error).message);
    } finally {
      setVideoActionLoading(null);
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
      <p className="mt-1 text-sm text-zinc-400">
        {isAdmin
          ? 'Admin controls. Target users by exact `@handle`.'
          : 'Moderation controls. Target videos and reports for review.'}
      </p>

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
          <h3 className="text-sm font-semibold">Creator Access Controls</h3>
          <p className="text-xs text-zinc-500">
            Manage channel verification, live streaming access, and moderation access for an exact `@handle`.
          </p>
          <input value={verifyHandle} onChange={(event) => setVerifyHandle(event.target.value)} placeholder="@target_handle" required className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3" />
          {creatorPreviewLoading ? (
            <p className="text-xs text-zinc-500">Looking up handle...</p>
          ) : null}
          {creatorPreviewError ? (
            <p className="text-xs text-red-400">{creatorPreviewError}</p>
          ) : null}
          {creatorPreview ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-3">
              <div className="flex items-center gap-3">
                <Image
                  src={creatorPreview.avatar_url || '/avatar-placeholder.svg'}
                  alt={creatorPreview.username}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold">{creatorPreview.username}</p>
                  <p className="text-xs text-zinc-500">{creatorPreview.handle}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                <p>Verified: {creatorPreview.verified ? 'Yes' : 'No'}</p>
                <p>Top Streamer: {creatorPreview.top_streamer ? 'Yes' : 'No'}</p>
                <p>Admin: {creatorPreview.is_admin ? 'Yes' : 'No'}</p>
                <p>Live Access: {creatorPreview.can_stream_live ? 'Yes' : 'No'}</p>
                <p>Moderation Access: {creatorPreview.can_moderate ? 'Yes' : 'No'}</p>
              </div>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />
            Verified channel
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={topStreamer}
              onChange={(event) => setTopStreamer(event.target.checked)}
            />
            Top ViewTube Streamer badge
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={canStreamLive}
              onChange={(event) => setCanStreamLive(event.target.checked)}
            />
            Live streaming enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={canModerate}
              onChange={(event) => setCanModerate(event.target.checked)}
            />
            Moderation access
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

      {activeTab === 'earn' && (
        <div className="mt-5 space-y-4 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Earn Applications</h3>
          {earnLoading ? <p className="text-sm text-zinc-400">Loading applications...</p> : null}
          {!earnLoading && !earnApplications.length ? (
            <p className="text-sm text-zinc-400">No earn applications yet.</p>
          ) : null}
          <div className="space-y-3">
            {earnApplications.map((item) => (
              <article key={item.id} className="rounded-lg border border-zinc-700 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.full_name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.email} • {(item.profile?.username || 'User')} {item.profile?.handle ? `(${item.profile.handle})` : ''}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Subscribers: {Number(item.profile?.subscribers_count || 0).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Status: {item.status}</p>
                </div>
                {item.channel_focus ? (
                  <p className="mt-2 text-xs text-zinc-400">Channel focus: {item.channel_focus}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{item.why_join}</p>
                <textarea
                  rows={2}
                  value={earnNote[item.id] ?? item.admin_notes ?? ''}
                  onChange={(event) => setEarnNote((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="Admin notes"
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs"
                />
                {item.status === 'pending' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onEarnDecision(item, 'approved')}
                      disabled={earnActionLoading === item.id}
                      className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void onEarnDecision(item, 'rejected')}
                      disabled={earnActionLoading === item.id}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reported' && (
        <div className="mt-5 space-y-4 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Reported Videos</h3>
          {!reports.length ? <p className="text-sm text-zinc-400">No reports yet.</p> : null}
          <div className="space-y-3">
            {reports.map((item) => (
              <article key={item.id} className="rounded-lg border border-zinc-700 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.video?.title || 'Video unavailable'}</p>
                    <p className="text-xs text-zinc-500">
                      Reporter: {(item.reporter?.username || 'User')} {item.reporter?.handle ? `(${item.reporter.handle})` : ''}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Status: {item.status}</p>
                </div>
                <p className="mt-2 text-xs text-zinc-400">Reason: {item.reason}</p>
                {item.details ? <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-500">{item.details}</p> : null}
                {item.video?.video_url ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-black">
                    <video src={item.video.video_url} controls preload="metadata" className="aspect-video w-full" />
                  </div>
                ) : null}
                <textarea
                  rows={2}
                  value={reportNote[item.id] ?? item.admin_note ?? ''}
                  onChange={(event) => setReportNote((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="Admin note"
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs"
                />
                <input
                  value={takedownMessage[item.id] ?? ''}
                  onChange={(event) => setTakedownMessage((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="Takedown message to creator (used only for takedown)"
                  className="mt-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onReportAction(item, 'acknowledge')}
                    disabled={reportActionLoading === item.id}
                    className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                  >
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReportAction(item, 'dismiss')}
                    disabled={reportActionLoading === item.id}
                    className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                  >
                    Not a Violation
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReportAction(item, 'takedown')}
                    disabled={reportActionLoading === item.id}
                    className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                  >
                    Take Down Video
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Reported {new Date(item.created_at).toLocaleString()}
                  {item.video?.is_removed ? ` • Removed: ${item.video.removed_reason || 'No reason provided'}` : ''}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="mt-5 space-y-4 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Admin Video Takedown</h3>
          <p className="text-xs text-zinc-500">
            Remove or restore any video. Takedown reason is sent to the creator as an alert notification.
          </p>
          {videoError && <p className="text-sm text-red-400">{videoError}</p>}
          {videoMessage && <p className="text-sm text-green-400">{videoMessage}</p>}
          {videosLoading ? <p className="text-sm text-zinc-400">Loading videos...</p> : null}
          {!videosLoading && !videos.length ? (
            <p className="text-sm text-zinc-400">No videos found.</p>
          ) : null}
          <div className="space-y-3">
            {videos.map((item) => (
              <article key={item.id} className="rounded-lg border border-zinc-700 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-zinc-500">
                      Creator: {item.profile?.username || 'Unknown'} {item.profile?.handle ? `(${item.profile.handle})` : ''}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Views: {Number(item.views || 0).toLocaleString()} • Uploaded:{' '}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Status: {item.is_removed ? `Removed (${item.removed_reason || 'No reason'})` : 'Live'}
                    </p>
                  </div>
                </div>
                {item.video_url ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700 bg-black">
                    <video src={item.video_url} controls preload="metadata" className="aspect-video w-full" />
                  </div>
                ) : null}
                <input
                  value={videoReason[item.id] ?? item.removed_reason ?? ''}
                  onChange={(event) => setVideoReason((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="Reason shown to creator when removed"
                  className="mt-3 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {!item.is_removed ? (
                    <button
                      type="button"
                      onClick={() => void onVideoAction(item, 'takedown')}
                      disabled={videoActionLoading === item.id}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                    >
                      Take Down Video
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onVideoAction(item, 'restore')}
                      disabled={videoActionLoading === item.id}
                      className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                    >
                      Restore Video
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'alert' && isAdmin && (
        <div className="mt-5 space-y-4 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Site Alert Banner</h3>
          <p className="text-xs text-zinc-500">
            Shows a red alert banner at the very top of ViewTube and Studio. Users can dismiss it locally, and you can deactivate it at any time.
          </p>

          <form onSubmit={onPublishSiteAlert} className="space-y-3">
            <textarea
              value={siteAlertMessage}
              onChange={(event) => setSiteAlertMessage(event.target.value)}
              rows={3}
              maxLength={800}
              placeholder="Alert message"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm"
              required
            />
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={siteAlertActive}
                onChange={(event) => setSiteAlertActive(event.target.checked)}
              />
              Publish as active immediately
            </label>

            {siteAlertError ? <p className="text-sm text-red-400">{siteAlertError}</p> : null}
            {siteAlertNotice ? <p className="text-sm text-green-400">{siteAlertNotice}</p> : null}

            <button
              type="submit"
              disabled={siteAlertLoading}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {siteAlertLoading ? 'Saving…' : 'Publish Alert'}
            </button>
          </form>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Recent alerts</h4>
            {!siteAlerts.length ? (
              <p className="mt-2 text-sm text-zinc-400">No alerts created yet.</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {siteAlerts.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-zinc-200">{item.message}</p>
                      <p className="mt-1 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-zinc-500">Status: {item.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                    <div className="flex gap-2">
                      {item.is_active ? (
                        <button
                          type="button"
                          disabled={siteAlertLoading}
                          onClick={() => void onToggleSiteAlert(item, false)}
                          className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={siteAlertLoading}
                          onClick={() => void onToggleSiteAlert(item, true)}
                          className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'popup' && isAdmin && (
        <div className="mt-5 space-y-4 rounded-xl border border-zinc-700 p-4">
          <h3 className="text-sm font-semibold">Site Popup</h3>
          <p className="text-xs text-zinc-500">
            Shows a dismissible popup to everyone. It includes your admin profile (pfp, handle, verified badge) and auto-hides after the duration you set.
          </p>

          <form onSubmit={onPublishSitePopup} className="space-y-3">
            <textarea
              value={sitePopupMessage}
              onChange={(event) => setSitePopupMessage(event.target.value)}
              rows={4}
              maxLength={800}
              placeholder="Popup message"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm"
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-zinc-200">
                <span className="block text-xs text-zinc-400">Auto-dismiss after (seconds)</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={sitePopupDuration}
                  onChange={(event) => setSitePopupDuration(Number(event.target.value) || 60)}
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200 sm:mt-6">
                <input
                  type="checkbox"
                  checked={sitePopupSound}
                  onChange={(event) => setSitePopupSound(event.target.checked)}
                />
                Play sound
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={sitePopupActive}
                onChange={(event) => setSitePopupActive(event.target.checked)}
              />
              Publish as active immediately
            </label>

            {sitePopupError ? <p className="text-sm text-red-400">{sitePopupError}</p> : null}
            {sitePopupNotice ? <p className="text-sm text-green-400">{sitePopupNotice}</p> : null}

            <button
              type="submit"
              disabled={sitePopupLoading}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
            >
              {sitePopupLoading ? 'Saving…' : 'Publish Popup'}
            </button>
          </form>

          <div className="rounded-xl border border-zinc-700 p-4">
            <h4 className="text-sm font-semibold">Recent popups</h4>
            {!sitePopups.length ? (
              <p className="mt-2 text-sm text-zinc-400">No popups created yet.</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {sitePopups.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-700 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-zinc-200">{item.message}</p>
                      <p className="mt-1 text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-zinc-500">Status: {item.is_active ? 'Active' : 'Inactive'}</p>
                      {item.expires_at ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          Expires: {new Date(item.expires_at).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {item.is_active ? (
                        <button
                          type="button"
                          disabled={sitePopupLoading}
                          onClick={() => void onToggleSitePopup(item, false)}
                          className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={sitePopupLoading}
                          onClick={() => void onToggleSitePopup(item, true)}
                          className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-60"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                    {item.contact_email} • Payment Ref: {item.payment_reference || item.paypal_transaction_id || 'N/A'}
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
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => void onSubmissionAction(item, 'launch_paid')}
                      disabled={submissionActionLoading === item.id}
                      className="rounded-full border border-amber-500 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-900/30 disabled:opacity-60"
                    >
                      Launch Without Payment
                    </button>
                  </div>
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
                    Provider: {item.payment_provider || 'fourthwall'} • Ref:{' '}
                    {item.payment_reference || item.paypal_transaction_id || 'N/A'} • Amount: $
                    {Number(item.payment_amount_usd || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Paid at: {item.paid_at ? new Date(item.paid_at).toLocaleString() : 'Pending webhook'}
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
                  <p className="mt-2 text-xs text-zinc-500">
                    Impressions: {(item.impressions_count || 0).toLocaleString()} • Clicks:{' '}
                    {(item.clicks_count || 0).toLocaleString()} • Completions:{' '}
                    {(item.completions_count || 0).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    CTR:{' '}
                    {item.impressions_count
                      ? `${(((item.clicks_count || 0) / item.impressions_count) * 100).toFixed(2)}%`
                      : '0.00%'}{' '}
                    • Last served:{' '}
                    {item.last_served_at ? new Date(item.last_served_at).toLocaleString() : 'Never'}
                  </p>
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
