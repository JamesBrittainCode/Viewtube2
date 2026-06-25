type CompanionAd = {
  id: string;
  title: string;
  click_url: string;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
};

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function AdCompanionCard({
  ad,
  preview = false,
}: {
  ad: CompanionAd;
  preview?: boolean;
}) {
  const clickHref = preview
    ? ad.click_url
    : `/api/ads/click?ad=${encodeURIComponent(ad.id)}&to=${encodeURIComponent(ad.click_url)}`;
  const sponsorHost = hostLabel(ad.click_url);
  const logoUrl = ad.logo_url || ad.thumbnail_url || null;
  const bannerUrl = ad.banner_url || null;

  return (
    <article className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className="aspect-[16/5] w-full bg-zinc-900 object-cover" />
      ) : null}
      <div className="flex items-center gap-3 p-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full bg-zinc-900 object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-black text-zinc-950 dark:text-white">{ad.title}</h3>
          <p className="truncate text-xs font-semibold text-zinc-500">
            Sponsored · {sponsorHost}
          </p>
        </div>
        <a
          href={clickHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-red-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-red-500 dark:hover:text-white"
        >
          Learn more
        </a>
      </div>
    </article>
  );
}
