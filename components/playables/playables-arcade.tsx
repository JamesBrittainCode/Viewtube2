'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Gamepad2, MousePointer2, RadioTower, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProgressRow = {
  game_key: string;
  high_score: number;
  level: number;
  plays: number;
  last_score: number;
  updated_at?: string;
};

type GameKey = 'bubble-pop' | 'memory-flip' | 'signal-sprint';

const games: Array<{
  key: GameKey;
  title: string;
  tagline: string;
  icon: typeof Gamepad2;
  accent: string;
}> = [
  {
    key: 'bubble-pop',
    title: 'Bubble Pop',
    tagline: 'Pop as many creator bubbles as you can in 30 seconds.',
    icon: MousePointer2,
    accent: 'from-red-600 to-orange-400',
  },
  {
    key: 'memory-flip',
    title: 'Memory Flip',
    tagline: 'Match the ViewTube cards with fewer moves.',
    icon: Brain,
    accent: 'from-fuchsia-600 to-red-500',
  },
  {
    key: 'signal-sprint',
    title: 'Signal Sprint',
    tagline: 'Tap the correct signal before the meter burns out.',
    icon: RadioTower,
    accent: 'from-rose-600 to-yellow-400',
  },
];

function makeProgressMap(rows: ProgressRow[]) {
  return new Map(rows.map((row) => [row.game_key, row]));
}

async function saveProgress(gameKey: GameKey, score: number, level: number, stats: Record<string, unknown>) {
  const res = await fetch('/api/playables/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameKey, score, level, stats }),
  });
  const data = (await res.json().catch(() => ({}))) as { progress?: ProgressRow; error?: string };
  if (!res.ok) throw new Error(data.error || 'Could not save progress.');
  return data.progress;
}

export function PlayablesArcade({ initialProgress }: { initialProgress: ProgressRow[] }) {
  const [selected, setSelected] = useState<GameKey>('bubble-pop');
  const [progress, setProgress] = useState(() => makeProgressMap(initialProgress));
  const selectedGame = games.find((game) => game.key === selected) || games[0];

  const handleSaved = useCallback((row?: ProgressRow) => {
    if (!row) return;
    setProgress((current) => new Map(current).set(row.game_key, row));
  }, []);

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-8 overflow-hidden rounded-[2rem] border border-zinc-200 bg-zinc-950 text-white shadow-2xl dark:border-zinc-800">
        <div className="relative p-6 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.45),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.35),transparent_30%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-red-100">
                <Gamepad2 className="h-4 w-4" />
                ViewTube Playables
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">Tiny games. Big scores.</h1>
              <p className="mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">
                Play quick arcade games between videos. Your high scores, plays, and levels save automatically to your account.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm backdrop-blur">
              <div className="text-zinc-300">Total plays</div>
              <div className="text-3xl font-black">
                {[...progress.values()].reduce((sum, row) => sum + Number(row.plays || 0), 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {games.map((game) => {
          const Icon = game.icon;
          const row = progress.get(game.key);
          const active = selected === game.key;
          return (
            <button
              key={game.key}
              type="button"
              onClick={() => setSelected(game.key)}
              className={cn(
                'group rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5',
                active
                  ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950',
              )}
            >
              <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white', game.accent)}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="text-lg font-bold">{game.title}</div>
              <p className="mt-1 text-sm text-zinc-500">{game.tagline}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Best" value={row?.high_score || 0} />
                <Stat label="Level" value={row?.level || 1} />
                <Stat label="Plays" value={row?.plays || 0} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{selectedGame.title}</h2>
            <p className="text-sm text-zinc-500">{selectedGame.tagline}</p>
          </div>
          <div className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-800">
            High score: {progress.get(selected)?.high_score || 0}
          </div>
        </div>
        {selected === 'bubble-pop' ? <BubblePop onSaved={handleSaved} /> : null}
        {selected === 'memory-flip' ? <MemoryFlip onSaved={handleSaved} /> : null}
        {selected === 'signal-sprint' ? <SignalSprint onSaved={handleSaved} /> : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-2 dark:bg-zinc-900">
      <div className="text-zinc-500">{label}</div>
      <div className="text-sm font-black">{value}</div>
    </div>
  );
}

function BubblePop({ onSaved }: { onSaved: (row?: ProgressRow) => void }) {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(30);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [target, setTarget] = useState({ x: 45, y: 45 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Hit start, then pop the red bubble.');

  useEffect(() => {
    if (!running) return;
    if (time <= 0) {
      setRunning(false);
      setSaving(true);
      saveProgress('bubble-pop', score, level, { seconds: 30 })
        .then(onSaved)
        .then(() => setMessage('Saved! Try beating your best.'))
        .catch((error) => setMessage(error.message))
        .finally(() => setSaving(false));
      return;
    }
    const timer = window.setTimeout(() => setTime((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [level, onSaved, running, score, time]);

  function start() {
    setScore(0);
    setLevel(1);
    setTime(30);
    setRunning(true);
    setMessage('Go!');
    moveTarget();
  }

  function moveTarget() {
    setTarget({ x: 8 + Math.random() * 78, y: 12 + Math.random() * 68 });
  }

  function pop() {
    if (!running) return;
    const nextScore = score + 10 + level * 2;
    setScore(nextScore);
    setLevel(1 + Math.floor(nextScore / 100));
    moveTarget();
  }

  return (
    <div>
      <GameHud score={score} level={level} detail={`${time}s`} saving={saving} onStart={start} running={running} />
      <div className="relative mt-4 h-[420px] overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_center,#27272a,#09090b)]">
        <button
          type="button"
          onClick={pop}
          className="absolute flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-3xl shadow-[0_0_50px_rgba(239,68,68,0.65)] transition hover:scale-110"
          style={{ left: `${target.x}%`, top: `${target.y}%` }}
        >
          ▶
        </button>
        <div className="absolute bottom-4 left-4 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur">{message}</div>
      </div>
    </div>
  );
}

function MemoryFlip({ onSaved }: { onSaved: (row?: ProgressRow) => void }) {
  const symbols = useMemo(() => ['▶', '🔥', '🎬', '⭐', '🎮', '📺'], []);
  const [cards, setCards] = useState<string[]>([]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [saving, setSaving] = useState(false);

  function start() {
    setCards([...symbols, ...symbols].sort(() => Math.random() - 0.5));
    setOpen([]);
    setMatched([]);
    setMoves(0);
  }

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open.length !== 2) return;
    const [first, second] = open;
    if (cards[first] === cards[second]) {
      setMatched((items) => [...items, first, second]);
      setOpen([]);
    } else {
      const timer = window.setTimeout(() => setOpen([]), 650);
      return () => window.clearTimeout(timer);
    }
  }, [cards, open]);

  useEffect(() => {
    if (!cards.length || matched.length !== cards.length) return;
    const score = Math.max(120, 1000 - moves * 35);
    const level = Math.max(1, Math.ceil(score / 220));
    setSaving(true);
    saveProgress('memory-flip', score, level, { moves })
      .then(onSaved)
      .catch(() => null)
      .finally(() => setSaving(false));
  }, [cards.length, matched.length, moves, onSaved]);

  function flip(index: number) {
    if (open.length >= 2 || open.includes(index) || matched.includes(index)) return;
    setOpen((items) => [...items, index]);
    setMoves((value) => value + 1);
  }

  const score = Math.max(0, 1000 - moves * 35);
  const level = Math.max(1, Math.ceil(score / 220));

  return (
    <div>
      <GameHud score={score} level={level} detail={`${moves} moves`} saving={saving} onStart={start} running={false} startLabel="Shuffle" />
      <div className="mt-4 grid grid-cols-3 gap-3 rounded-[2rem] bg-zinc-100 p-4 dark:bg-zinc-900 sm:grid-cols-4">
        {cards.map((symbol, index) => {
          const visible = open.includes(index) || matched.includes(index);
          return (
            <button
              key={`${symbol}-${index}`}
              type="button"
              onClick={() => flip(index)}
              className="h-24 rounded-2xl [perspective:700px]"
            >
              <span
                className={cn(
                  'flex h-full w-full items-center justify-center rounded-2xl border text-4xl shadow-sm transition duration-300 [transform-style:preserve-3d]',
                  visible
                    ? 'border-red-500 bg-white [transform:rotateY(180deg)] dark:bg-zinc-950'
                    : 'border-zinc-300 bg-gradient-to-br from-red-600 to-zinc-950 dark:border-zinc-700',
                )}
              >
                <span className={visible ? '[transform:rotateY(180deg)]' : 'text-transparent'}>{symbol}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SignalSprint({ onSaved }: { onSaved: (row?: ProgressRow) => void }) {
  const options = ['Upload', 'Like', 'Comment', 'Live'];
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState('Upload');
  const [time, setTime] = useState(45);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (time <= 0) {
      setRunning(false);
      setSaving(true);
      saveProgress('signal-sprint', score, level, { seconds: 45 })
        .then(onSaved)
        .catch(() => null)
        .finally(() => setSaving(false));
      return;
    }
    const timer = window.setTimeout(() => setTime((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [level, onSaved, running, score, time]);

  function start() {
    setScore(0);
    setLevel(1);
    setTime(45);
    setRunning(true);
    setPrompt(options[Math.floor(Math.random() * options.length)]);
  }

  function choose(value: string) {
    if (!running) return;
    if (value === prompt) {
      const nextScore = score + 15 + level * 3;
      setScore(nextScore);
      setLevel(1 + Math.floor(nextScore / 150));
    } else {
      setScore((current) => Math.max(0, current - 20));
    }
    setPrompt(options[Math.floor(Math.random() * options.length)]);
  }

  return (
    <div>
      <GameHud score={score} level={level} detail={`${time}s`} saving={saving} onStart={start} running={running} />
      <div className="mt-4 rounded-[2rem] bg-zinc-950 p-6 text-white">
        <div className="mb-6 text-center">
          <div className="text-sm uppercase tracking-[0.35em] text-red-300">Tap the signal</div>
          <div className="mt-3 text-5xl font-black">{prompt}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {options.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => choose(item)}
              className="rounded-2xl bg-white px-4 py-6 text-lg font-black text-zinc-950 transition hover:-translate-y-1 hover:bg-red-500 hover:text-white"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameHud({
  score,
  level,
  detail,
  saving,
  running,
  onStart,
  startLabel = 'Start',
}: {
  score: number;
  level: number;
  detail: string;
  saving: boolean;
  running: boolean;
  onStart: () => void;
  startLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-100 p-3 dark:bg-zinc-900">
      <div className="flex gap-2">
        <Stat label="Score" value={score} />
        <Stat label="Level" value={level} />
        <div className="rounded-2xl bg-white p-2 text-xs dark:bg-zinc-950">
          <div className="text-zinc-500">Round</div>
          <div className="text-sm font-black">{detail}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {saving ? <span className="text-sm text-zinc-500">Saving…</span> : null}
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500"
        >
          {running ? <Sparkles className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          {startLabel}
        </button>
      </div>
    </div>
  );
}
