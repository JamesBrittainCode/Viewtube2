'use client';

import Link from 'next/link';
import { MoreVertical, Search, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type PlayableGame = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  game_url: string;
  plays_count: number;
  created_at: string;
};

type ProgressRow = {
  game_key: string;
  high_score: number;
  level: number;
  plays: number;
  last_score: number;
};

export function PlayablesArcade({
  games,
  initialProgress,
}: {
  games: PlayableGame[];
  initialProgress: ProgressRow[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const progress = useMemo(() => new Map(initialProgress.map((row) => [row.game_key, row])), [initialProgress]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(games.map((game) => game.category || 'Arcade')))], [games]);
  const filtered = games.filter((game) => {
    const matchesCategory = category === 'All' || game.category === category;
    const text = `${game.title} ${game.description} ${game.category}`.toLowerCase();
    return matchesCategory && text.includes(query.trim().toLowerCase());
  });

  return (
    <section className="-mx-4 -mt-2 md:-mx-6 lg:-mx-8">
      <div className="border-b border-zinc-200 px-4 pb-0 dark:border-zinc-800 md:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#214f67] shadow-lg">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-3.5 w-3.5 rounded-full bg-lime-200',
                    index === 4 || index === 8 ? 'rotate-45 rounded-sm bg-yellow-200' : '',
                  )}
                />
              ))}
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">Playables</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">Pick a game and play instantly. Scores and levels save to your ViewTube account.</p>
          </div>
        </div>

        <div className="mt-6 flex items-end gap-8">
          <button type="button" className="pb-4 text-lg font-bold text-zinc-500">Home</button>
          <button type="button" className="border-b-2 border-zinc-900 pb-4 text-lg font-bold dark:border-white">Browse</button>
        </div>
      </div>

      <div className="px-4 py-6 md:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search playables"
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-red-500 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
                  category === item ? 'bg-white text-zinc-950 shadow dark:bg-zinc-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((game) => (
              <PlayableCard key={game.id} game={game} progress={progress.get(game.slug)} />
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-800">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
            <h2 className="text-xl font-bold">No playables yet</h2>
            <p className="mt-1 text-sm text-zinc-500">Upload HTML games from the admin panel and they’ll show up here.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PlayableCard({ game, progress }: { game: PlayableGame; progress?: ProgressRow }) {
  return (
    <Link href={`/playables/${game.slug}`} className="group block rounded-2xl p-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-900">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 shadow-sm transition group-hover:shadow-xl">
        {game.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-600 to-zinc-950 text-5xl">▶</div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-1 text-base font-black">{game.title}</h2>
          <p className="line-clamp-1 text-sm font-medium text-zinc-500">{game.category || 'Arcade'}</p>
          <div className="mt-1 text-xs text-zinc-500">
            Best {progress?.high_score || 0} · Level {progress?.level || 1}
          </div>
        </div>
        <MoreVertical className="mt-1 h-5 w-5 shrink-0 text-zinc-500" />
      </div>
    </Link>
  );
}
