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

        <div className="absolute inset-0 flex items-end justify-end p-4 sm:p-6">
          <div className="-translate-x-1 translate-y-1 flex w-[200px] flex-col items-end pb-0 text-right text-white sm:-translate-x-2 sm:w-[230px]">
            <Link
              href="/petition/yikes"
              className="inline-flex min-w-[132px] items-center justify-center rounded-full border-2 border-white/90 bg-white/10 px-6 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              Petition
            </Link>
            <p className="mt-2 text-xs text-white/90">{votes.toLocaleString()} votes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
