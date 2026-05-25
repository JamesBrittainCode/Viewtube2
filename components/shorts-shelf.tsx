'use client';

import Image from 'next/image';
import Link from 'next/link';

type ShortItem = {
  id: string;
  title: string;
  thumbnail_url: string | null;
};

export function ShortsShelf({ shorts }: { shorts: ShortItem[] }) {
  if (!shorts.length) return null;

  return (
    <section className="my-8">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">Shorts</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Quick vertical videos</div>
        </div>
        <Link href="/shorts" className="text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300">
          View all
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shorts.map((item) => (
          <Link key={item.id} href={`/shorts/${item.id}`} className="group w-[160px] shrink-0">
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800">
              <Image
                src={item.thumbnail_url || '/thumbnail-placeholder.svg'}
                alt={item.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-[1.03]"
                sizes="160px"
              />
              <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                Shorts
              </div>
            </div>
            <div className="mt-2 line-clamp-2 text-xs font-semibold text-zinc-900 dark:text-white">{item.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

