'use client';

import Link from 'next/link';
import { ArrowLeft, Gamepad2, Maximize2, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Game = {
  title: string;
  slug: string;
  description: string;
  game_url: string;
  instructions: string;
};

type Progress = {
  high_score: number;
  level: number;
  plays: number;
  last_score: number;
} | null;

export function PlayablePlayer({ game, progress }: { game: Game; progress: Progress }) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(progress);
  const [saving, setSaving] = useState(false);
  const src = useMemo(() => game.game_url, [game.game_url]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 5000);
    return () => window.clearTimeout(timer);
  }, [src]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; score?: number; level?: number; stats?: Record<string, unknown> };
      if (!data || data.type !== 'viewtube-playable-score') return;
      setSaving(true);
      fetch('/api/playables/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameKey: game.slug,
          score: Number(data.score || 0),
          level: Number(data.level || 1),
          stats: data.stats || {},
        }),
      })
        .then((res) => res.json())
        .then((payload) => {
          if (payload?.progress) setSaved(payload.progress);
        })
        .catch(() => null)
        .finally(() => setSaving(false));
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game.slug]);

  function recordPlay() {
    if (saved?.last_score) return;
    fetch('/api/playables/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameKey: game.slug, score: 0, level: 1, stats: { launched: true } }),
    })
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.progress) setSaved(payload.progress);
      })
      .catch(() => null);
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/playables" className="rounded-full border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black">{game.title}</h1>
            <p className="text-sm text-zinc-500">{game.description || 'ViewTube Playable'}</p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <Pill icon={<Trophy className="h-4 w-4" />} label={`Best ${saved?.high_score || 0}`} />
          <Pill icon={<Gamepad2 className="h-4 w-4" />} label={`Level ${saved?.level || 1}`} />
          {saving ? <Pill label="Saving…" /> : null}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-black shadow-2xl">
        {loading ? <PlayablesLoader title={game.title} /> : null}
        <iframe
          title={game.title}
          src={src}
          onLoad={() => {
            setLoading(false);
            recordPlay();
          }}
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-downloads"
          allow="gamepad; fullscreen; autoplay"
          className="h-[72vh] min-h-[520px] w-full bg-black"
        />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black"
        >
          <Maximize2 className="h-4 w-4" />
        </a>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="font-bold">Game notes</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-500">
          {game.instructions ||
            'If your HTML game wants to save a score, post this message from inside the game: window.parent.postMessage({ type: "viewtube-playable-score", score: 100, level: 2 }, "*").'}
        </p>
      </div>
    </section>
  );
}

function Pill({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 font-semibold dark:border-zinc-800">
      {icon}
      {label}
    </div>
  );
}

function PlayablesLoader({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
      <div className="relative text-center text-white">
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/30 blur-3xl" />
        <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/10 shadow-[0_0_70px_rgba(239,68,68,0.45)] backdrop-blur">
          <Gamepad2 className="h-10 w-10 animate-pulse text-red-300" />
        </div>
        <div className="relative text-3xl font-black">Loading {title}</div>
        <div className="relative mt-4 h-2 w-72 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[playablesLoad_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-red-600" />
        </div>
        <div className="relative mt-3 text-xs uppercase tracking-[0.35em] text-zinc-400">warming up the arcade</div>
      </div>
    </div>
  );
}
