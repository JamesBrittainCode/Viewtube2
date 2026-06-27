'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Save, Trash2, X } from 'lucide-react';
import { SponsoredHomeBanner } from '@/components/ads/sponsored-home-banner';
import { AD_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

type BannerAd = {
  id: string;
  title: string;
  image_url: string;
  click_url: string;
  placement: string;
  approved: boolean;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  impressions_count?: number | null;
  clicks_count?: number | null;
  created_at: string;
};

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function fileExt(name: string, fallback: string) {
  const last = name.split('.').pop()?.toLowerCase() || '';
  const safe = last.replace(/[^a-z0-9]/g, '');
  return safe || fallback;
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

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Banner ad action failed';
  } catch {
    return text || 'Banner ad action failed';
  }
}

function BannerEditForm({ item, onDone }: { item: BannerAd; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [imageUrl, setImageUrl] = useState(item.image_url);
  const [clickUrl, setClickUrl] = useState(item.click_url);
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInput(item.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeInput(item.ends_at));
  const [approved, setApproved] = useState(item.approved);
  const [active, setActive] = useState(item.is_active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/banner-ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          title,
          image_url: imageUrl,
          click_url: clickUrl,
          placement: 'home_top',
          approved,
          is_active: active,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-black p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Edit banner</h4>
        <button type="button" onClick={onDone} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" placeholder="Title" />
      <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" placeholder="Image URL" />
      <input value={clickUrl} onChange={(event) => setClickUrl(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" placeholder="Click URL" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={startsAt} onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        <input value={endsAt} onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
      </div>
      <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /> Approved</label>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
      </div>
      {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-black text-zinc-950 transition hover:bg-red-500 hover:text-white disabled:opacity-60">
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Save banner'}
      </button>
    </form>
  );
}

export function AdminBannerAdWorkspace({ initialBannerAds }: { initialBannerAds: BannerAd[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('Sponsored');
  const [clickUrl, setClickUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [active, setActive] = useState(true);
  const [approved, setApproved] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const imagePreviewUrl = useObjectUrl(imageFile);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!imageFile) throw new Error('Please upload a banner image.');
      if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) throw new Error('Banner must be PNG, JPEG, WEBP, or GIF.');
      let parsedClick: URL;
      try {
        parsedClick = new URL(clickUrl);
      } catch {
        throw new Error('Please enter a valid click URL.');
      }

      const supabase = createClient();
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt(imageFile.name, 'jpg')}`;
      const { error: uploadError } = await supabase.storage.from(AD_BUCKET).upload(path, imageFile, {
        cacheControl: '3600',
        contentType: imageFile.type || 'image/jpeg',
        upsert: false,
      });
      if (uploadError) throw new Error(uploadError.message);
      const imageUrl = supabase.storage.from(AD_BUCKET).getPublicUrl(path).data.publicUrl;

      const res = await fetch('/api/admin/banner-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          image_url: imageUrl,
          click_url: parsedClick.toString(),
          placement: 'home_top',
          approved,
          is_active: active,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));

      setMessage('Homepage banner ad saved.');
      setTitle('Sponsored');
      setClickUrl('');
      setImageFile(null);
      setStartsAt('');
      setEndsAt('');
      setActive(true);
      setApproved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBanner(id: string) {
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/banner-ads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await parseApiError(res));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="grid gap-6 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 xl:grid-cols-[minmax(0,440px)_1fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white">Homepage banner ad</h2>
          <p className="mt-1 text-sm text-zinc-400">Upload your own banner image. It shows at the top of the homepage with a Sponsored label.</p>
        </div>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Internal title" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        <input value={clickUrl} onChange={(event) => setClickUrl(event.target.value)} placeholder="Click URL (https://...)" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        <label className="block rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-300">
          <span className="mb-2 flex items-center gap-2 font-black text-white"><ImagePlus className="h-4 w-4" /> Banner image</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
          <span className="mt-2 block text-xs text-zinc-500">Recommended: wide image, like 970×250 or 1200×250.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
          <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white" />
        </div>
        <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /> Approved</label>
          <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
        </div>
        {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}
        <button disabled={submitting} className="h-12 w-full rounded-full bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save homepage banner'}
        </button>
      </form>

      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Live preview</div>
          {imagePreviewUrl ? (
            <SponsoredHomeBanner ad={{ id: 'preview', title, image_url: imagePreviewUrl, click_url: clickUrl || 'https://example.com' }} preview />
          ) : (
            <div className="flex aspect-[6/1] items-center justify-center rounded-3xl border border-dashed border-zinc-700 bg-black text-sm font-semibold text-zinc-500">
              Upload an image to preview the homepage banner.
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Existing homepage banners</div>
          {initialBannerAds.length ? (
            initialBannerAds.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-800 bg-black p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.is_active && item.approved ? 'Active' : item.approved ? 'Paused' : 'Not approved'} · {(item.clicks_count || 0).toLocaleString()} clicks
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-black text-white hover:border-red-500 hover:bg-red-500">
                      Edit
                    </button>
                    <button type="button" onClick={() => void deleteBanner(item.id)} disabled={deleting === item.id} className="rounded-full border border-zinc-700 p-2 text-zinc-300 hover:border-red-500 hover:bg-red-500 hover:text-white disabled:opacity-60" aria-label="Delete banner">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <SponsoredHomeBanner ad={item} preview />
                </div>
                {editingId === item.id ? <BannerEditForm item={item} onDone={() => setEditingId(null)} /> : null}
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-500">No homepage banner ads yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
