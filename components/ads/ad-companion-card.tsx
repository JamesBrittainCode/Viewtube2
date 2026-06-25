type CompanionAd = {
  id: string;
  title: string;
  click_url: string;
  thumbnail_url?: string | null;
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

  return (
    <article className="mb-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {ad.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.thumbnail_url} alt="" className="aspect-[16/5] w-full bg-zinc-900 object-cover" />
      ) : (
        <div className="aspect-[16/5] w-full bg-gradient-to-br from-red-600 via-zinc-900 to-zinc-950" />
      )}
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white">
          Ad
        </div>
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
