import Link from 'next/link';

export function RecommendedPetitionBanner({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#02B6F3] text-white shadow-sm">
      <div
        className="relative h-28 w-full bg-cover bg-center"
        style={{
          // Optional: if you add `/public/yikes-banner.png`, it will render automatically.
          backgroundImage: "url('/yikes-banner.png')",
        }}
      >
        <div className="absolute inset-0 bg-[#02B6F3]/85" />
        <div className="relative flex h-full items-center justify-between gap-4 px-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">yikes x ViewTube</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold">
              Sign the petition to make the collab happen
            </p>
            <p className="mt-1 text-xs text-white/90">{count.toLocaleString()} votes</p>
          </div>

          <Link
            href="/petition/yikes"
            className="shrink-0 rounded-full border-2 border-white/90 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            Petition
          </Link>
        </div>
      </div>
    </div>
  );
}

