import Image from 'next/image';
import Link from 'next/link';

export function YikesHomeBanner({ votes }: { votes: number }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative aspect-[3/1] w-full min-h-[120px]">
        <Image
          src="/yikes-banner.png"
          alt="yikes x ViewTube"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/10" />

        <div className="absolute inset-0 flex items-center justify-end p-4 sm:p-6">
          <div className="max-w-[240px] rounded-2xl bg-black/25 p-4 text-white backdrop-blur-sm sm:max-w-[300px]">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">Petition</p>
            <p className="mt-1 text-lg font-extrabold leading-tight">yikes x ViewTube</p>
            <p className="mt-1 text-xs text-white/90">{votes.toLocaleString()} votes</p>
            <Link
              href="/petition/yikes"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              Petition
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

