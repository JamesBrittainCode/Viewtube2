import { redirect } from 'next/navigation';
import { Megaphone, MousePointerClick, PlayCircle, Sidebar } from 'lucide-react';
import { AdCompanionCard } from '@/components/ads/ad-companion-card';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

type AdPreviewItem = {
  id: string;
  title: string;
  company?: string | null;
  video_url: string;
  click_url: string;
  thumbnail_url?: string | null;
  runtime_seconds?: number | null;
  status: string;
  skippable?: boolean | null;
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

function statusPill(item: AdPreviewItem) {
  const status = item.status.toLowerCase();
  const active = status.includes('active') || status.includes('paid') || status.includes('approved');
  return active
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    : 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function InVideoAdPreview({ item }: { item: AdPreviewItem }) {
  const host = hostLabel(item.click_url);
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
      <div className="relative aspect-video bg-zinc-950">
        <video src={item.video_url} preload="metadata" controls className="h-full w-full object-contain" />
        <div className="pointer-events-none absolute bottom-6 left-6 max-w-[min(460px,80%)] rounded-2xl bg-black/70 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-3">
            {item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnail_url} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">
                Ad
              </div>
            )}
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

function AdPreviewBlock({ item }: { item: AdPreviewItem }) {
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
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
              <li>Thumbnail/banner is clear at sidebar size.</li>
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

export default async function StudioAdminAdsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  if (!isAdminEmail(user.email)) redirect('/studio/admin');

  const [{ data: ads }, { data: submissions }] = await Promise.all([
    supabase
      .from('ads')
      .select(
        'id,title,video_url,click_url,thumbnail_url,runtime_seconds,skippable,approved,is_active,impressions_count,clicks_count,completions_count,created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('ad_submissions')
      .select(
        'id,ad_title,company_name,video_url,click_url,thumbnail_url,runtime_seconds,skippable,status,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const liveAds: AdPreviewItem[] = (ads || []).map((item) => ({
    id: item.id,
    title: item.title,
    video_url: item.video_url,
    click_url: item.click_url,
    thumbnail_url: item.thumbnail_url,
    runtime_seconds: item.runtime_seconds,
    skippable: item.skippable,
    impressions_count: item.impressions_count,
    clicks_count: item.clicks_count,
    completions_count: item.completions_count,
    created_at: item.created_at,
    status: item.is_active && item.approved ? 'Active' : item.approved ? 'Approved paused' : 'Not approved',
  }));

  const submittedAds: AdPreviewItem[] = (submissions || []).map((item) => ({
    id: item.id,
    title: item.ad_title,
    company: item.company_name,
    video_url: item.video_url,
    click_url: item.click_url,
    thumbnail_url: item.thumbnail_url,
    runtime_seconds: item.runtime_seconds,
    skippable: item.skippable,
    created_at: item.created_at,
    status: `Submission: ${item.status}`,
  }));

  const items = [...liveAds, ...submittedAds];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950/30 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-red-600 p-3 text-white">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Ad previews</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Review exactly how campaigns will feel on ViewTube: the in-video sponsored overlay, the sidebar companion
              unit above recommended videos, and the basic click destination.
            </p>
          </div>
        </div>
      </div>

      {items.length ? (
        <div className="space-y-6">
          {items.map((item) => (
            <AdPreviewBlock key={`${item.status}-${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
          No ads or submissions are available to preview yet.
        </div>
      )}
    </div>
  );
}
