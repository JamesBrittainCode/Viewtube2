'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit3, MousePointerClick, PlayCircle, Save, Sidebar, X } from 'lucide-react';
import { AdCompanionCard } from '@/components/ads/ad-companion-card';

export type AdminAdPreviewItem = {
  id: string;
  source: 'live' | 'submission';
  title: string;
  company?: string | null;
  video_url: string;
  click_url: string;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  runtime_seconds?: number | null;
  target_reach?: number | null;
  calculated_price_usd?: number | null;
  status: string;
  skippable?: boolean | null;
  approved?: boolean | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  impressions_count?: number | null;
  clicks_count?: number | null;
  completions_count?: number | null;
  created_at?: string | null;
};

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function statusPill(item: AdminAdPreviewItem) {
  const status = item.status.toLowerCase();
  const active = status.includes('active') || status.includes('paid') || status.includes('approved');
  return active
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Campaign update failed';
  } catch {
    return text || 'Campaign update failed';
  }
}

function InVideoAdPreview({ item }: { item: AdminAdPreviewItem }) {
  const host = hostLabel(item.click_url);
  const logoUrl = item.logo_url || item.thumbnail_url || null;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
      <div className="relative aspect-video bg-zinc-950">
        <video src={item.video_url} preload="metadata" controls className="h-full w-full object-contain" />
        <div className="pointer-events-none absolute bottom-6 left-6 max-w-[min(460px,80%)] rounded-2xl bg-black/70 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{item.title}</p>
              <p className="truncate text-xs text-zinc-300">{host}</p>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-950">Learn more</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-1.5 w-full bg-white/20" />
        <div className="absolute bottom-0 left-0 h-1.5 w-2/5 bg-yellow-400" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 px-4 py-3 text-xs text-zinc-400">
        <span>Sponsored preview · {item.skippable === false ? 'Non-skippable' : 'Skippable'}</span>
        <a href={item.click_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-red-300 hover:underline">
          Open destination
        </a>
      </div>
    </div>
  );
}

function CampaignEditForm({ item, onCancel }: { item: AdminAdPreviewItem; onCancel: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [clickUrl, setClickUrl] = useState(item.click_url);
  const [logoUrl, setLogoUrl] = useState(item.logo_url || item.thumbnail_url || '');
  const [bannerUrl, setBannerUrl] = useState(item.banner_url || '');
  const [targetReach, setTargetReach] = useState(item.target_reach ? String(item.target_reach) : '');
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInput(item.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalDateTimeInput(item.ends_at));
  const [skippable, setSkippable] = useState(item.skippable !== false);
  const [approved, setApproved] = useState(item.approved !== false);
  const [active, setActive] = useState(item.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          title,
          click_url: clickUrl,
          logo_url: logoUrl,
          banner_url: bannerUrl,
          target_reach: targetReach ? Number(targetReach) : null,
          skippable,
          approved,
          is_active: active,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setMessage('Campaign updated.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Edit live campaign</h3>
        <button type="button" onClick={onCancel} className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white" aria-label="Close editor">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ad title" className="h-11 w-full rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
      <input value={clickUrl} onChange={(event) => setClickUrl(event.target.value)} placeholder="Destination URL" className="h-11 w-full rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
      <div className="grid gap-3 lg:grid-cols-2">
        <input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="Logo URL (empty hides logo)" className="h-11 rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
        <input value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="Banner URL (empty hides banner)" className="h-11 rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <input value={targetReach} onChange={(event) => setTargetReach(event.target.value)} type="number" min="0" step="100" placeholder="Target reach" className="h-11 rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
        <input value={startsAt} onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" className="h-11 rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
        <input value={endsAt} onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" className="h-11 rounded-xl border border-zinc-700 bg-black px-3 text-sm text-white" />
      </div>
      <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={skippable} onChange={(event) => setSkippable(event.target.checked)} /> Skippable</label>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /> Approved</label>
        <label className="flex items-center gap-2 rounded-xl border border-zinc-800 p-3"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active now</label>
      </div>
      {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-black text-zinc-950 transition hover:bg-red-500 hover:text-white disabled:opacity-60">
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

function AdPreviewBlock({ item }: { item: AdminAdPreviewItem }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-white">{item.title}</h2>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${statusPill(item)}`}>
              {item.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {item.company ? `${item.company} · ` : null}
            {hostLabel(item.click_url)}
            {item.runtime_seconds ? ` · ${item.runtime_seconds}s` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {item.source === 'live' ? (
            <button onClick={() => setEditing((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-black text-white transition hover:border-red-500 hover:bg-red-500">
              <Edit3 className="h-4 w-4" />
              {editing ? 'Close edit' : 'Edit campaign'}
            </button>
          ) : null}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2">
              <div className="font-black text-white">{(item.impressions_count || 0).toLocaleString()}</div>
              <div className="text-zinc-500">Views</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2">
              <div className="font-black text-white">{(item.clicks_count || 0).toLocaleString()}</div>
              <div className="text-zinc-500">Clicks</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2">
              <div className="font-black text-white">{(item.completions_count || 0).toLocaleString()}</div>
              <div className="text-zinc-500">Done</div>
            </div>
          </div>
        </div>
      </div>

      {editing ? <CampaignEditForm item={item} onCancel={() => setEditing(false)} /> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            <PlayCircle className="h-4 w-4" />
            In-video ad
          </div>
          <InVideoAdPreview item={item} />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            <Sidebar className="h-4 w-4" />
            Above recommended
          </div>
          <AdCompanionCard ad={item} preview />
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-200">
              <MousePointerClick className="h-4 w-4" />
              QA checklist
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>Optional logo/banner are clear at sidebar size.</li>
              <li>Title fits in two lines.</li>
              <li>Button destination opens correctly.</li>
              <li>Creative still looks good with player controls over it.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AdminAdCampaignList({ items }: { items: AdminAdPreviewItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
        No ads or submissions are available to preview yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <AdPreviewBlock key={`${item.source}-${item.id}`} item={item} />
      ))}
    </div>
  );
}
