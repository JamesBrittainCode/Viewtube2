import Image from 'next/image';
import Link from 'next/link';

export function YikesHomeBanner({ votes }: { votes: number }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative aspect-[1375/413] w-full">
        <Image
          src="/yikes-banner.png"
          alt="yikes x ViewTube"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/5" />

        <div className="absolute bottom-5 right-8 flex w-[200px] flex-col items-end pb-0 text-right text-white sm:bottom-7 sm:right-12 sm:w-[230px]">
          <Link
            href="/petition/yikes"
            className="inline-flex min-w-[132px] items-center justify-center rounded-full border-2 border-white/90 bg-white/10 px-6 py-2 text-xs font-semibold text-white outline-none backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset"
          >
            Petition
          </Link>
          <p className="mt-2 text-xs text-white/90">{votes.toLocaleString()} votes</p>
        </div>
      </div>
    </div>
  );
}
