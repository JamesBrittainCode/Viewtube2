import Link from 'next/link';
import { Gamepad2, Sparkles, Trophy } from 'lucide-react';

const playableCards = [
  { title: 'Bubble Pop', body: 'Tap creator bubbles before time runs out.', icon: Sparkles },
  { title: 'Memory Flip', body: 'Match cards and climb levels.', icon: Trophy },
  { title: 'Signal Sprint', body: 'Hit the right signal as it speeds up.', icon: Gamepad2 },
] as const;

export function PlayablesShelf() {
  return (
    <section className="my-8 rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-red-50 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-red-950/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <Gamepad2 className="h-5 w-5 text-red-500" />
            ViewTube Playables
          </div>
          <p className="text-sm text-zinc-500">Quick games with saved scores and levels.</p>
        </div>
        <Link
          href="/playables"
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          Play now
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {playableCards.map(({ title, body, icon: Icon }) => (
          <Link
            key={title}
            href="/playables"
            className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-red-500/50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Icon className="mb-3 h-5 w-5 text-red-500 transition group-hover:scale-110" />
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-sm text-zinc-500">{body}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
