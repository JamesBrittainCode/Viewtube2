type SponsoredBannerAd = {
  id: string;
  title: string;
  image_url: string;
  click_url: string;
};

export function SponsoredHomeBanner({
  ad,
  preview = false,
}: {
  ad: SponsoredBannerAd;
  preview?: boolean;
}) {
  const href = preview
    ? ad.click_url
    : `/api/banner-ads/click?id=${encodeURIComponent(ad.id)}&to=${encodeURIComponent(ad.click_url)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${ad.title} sponsored ad`}
      className="group relative block overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100 shadow-sm transition hover:border-red-500 dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.image_url} alt={ad.title} className="aspect-[6/1] w-full object-cover transition duration-300 group-hover:scale-[1.01]" />
      <span className="absolute bottom-2 left-2 rounded-md bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white/80 shadow-sm ring-1 ring-white/10 backdrop-blur-sm">
        Sponsored
      </span>
    </a>
  );
}
