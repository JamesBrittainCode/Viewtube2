'use client';

import Link from 'next/link';
import { ArrowLeft, Gamepad2, Maximize2, Trophy, Users } from 'lucide-react';
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

type StreakAward = {
  points_delta?: number;
  points_total?: number;
  contest_status?: string;
  message?: string;
};

type RunReward = {
  score: number;
  pointsDelta: number;
  pointsTotal?: number;
  status: string;
  message: string;
};

export function PlayablePlayer({
  game,
  progress,
  pointsEligible = false,
}: {
  game: Game;
  progress: Progress;
  pointsEligible?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(progress);
  const [saving, setSaving] = useState(false);
  const [playingNow, setPlayingNow] = useState<number | null>(null);
  const [runReward, setRunReward] = useState<RunReward | null>(null);
  const [sessionId] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const src = useMemo(() => game.game_url, [game.game_url]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 5000);
    return () => window.clearTimeout(timer);
  }, [src]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; score?: number; level?: number; stats?: Record<string, unknown> };
      if (!data || data.type !== 'viewtube-playable-score') return;
      const score = Math.max(0, Math.floor(Number(data.score || 0)));
      const level = Math.max(1, Math.floor(Number(data.level || 1)));
      const gameOver = data.stats?.gameOver === true || data.stats?.status === 'game-over';
      setSaved((current) => ({
        high_score: Math.max(current?.high_score || 0, score),
        last_score: score,
        level: Math.max(current?.level || 1, level),
        plays: current?.plays || 0,
      }));
      if (game.slug === 'flappy-dunk' && !gameOver) return;
      setSaving(true);
      fetch('/api/playables/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameKey: game.slug,
          score,
          level,
          awardPoints: game.slug === 'flappy-dunk' && gameOver && pointsEligible,
          stats: {
            ...(data.stats || {}),
            pointsEligible,
            streakPoints: game.slug === 'flappy-dunk' ? '1 per score point, once per hour from the leaderboard' : null,
          },
        }),
      })
        .then((res) => res.json())
        .then((payload) => {
          if (payload?.progress) setSaved(payload.progress);
          if (game.slug === 'flappy-dunk' && gameOver) {
            const award = (payload?.streakAward || null) as StreakAward | null;
            const pointsDelta = Math.max(0, Number(award?.points_delta || 0));
            const pointsTotal =
              typeof award?.points_total === 'number' ? Math.max(0, Number(award.points_total)) : undefined;
            setRunReward({
              score,
              pointsDelta,
              pointsTotal,
              status: award?.contest_status || (pointsEligible ? 'saved' : 'not_eligible'),
              message:
                award?.message ||
                (pointsEligible
                  ? pointsDelta > 0
                    ? 'Nice run — those streak points landed.'
                    : 'Run saved, but this play did not earn extra points.'
                  : 'Run saved. Start Flappy Dunk from the leaderboard to earn streak points.'),
            });
            if (pointsDelta > 0) {
              window.dispatchEvent(new CustomEvent('viewtube-points', { detail: award }));
            }
          }
        })
        .catch(() => null)
        .finally(() => setSaving(false));
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [game.slug, pointsEligible]);

  useEffect(() => {
    let cancelled = false;

    async function pingPresence() {
      const response = await fetch('/api/playables/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameKey: game.slug, sessionId }),
      }).catch(() => null);
      if (!response || !response.ok) return;
      const payload = (await response.json().catch(() => null)) as { playingNow?: number } | null;
      if (!cancelled && typeof payload?.playingNow === 'number') setPlayingNow(payload.playingNow);
    }

    async function loadPresence() {
      const response = await fetch(`/api/playables/presence?gameKey=${encodeURIComponent(game.slug)}`).catch(() => null);
      if (!response || !response.ok) return;
      const payload = (await response.json().catch(() => null)) as { playingNow?: number } | null;
      if (!cancelled && typeof payload?.playingNow === 'number') setPlayingNow(payload.playingNow);
    }

    pingPresence();
    const heartbeat = window.setInterval(pingPresence, 15000);
    const poll = window.setInterval(loadPresence, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.clearInterval(poll);
    };
  }, [game.slug, sessionId]);

  function recordPlay() {
    if (game.slug === 'flappy-dunk') return;
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
          <Pill icon={<Users className="h-4 w-4" />} label={`${playingNow ?? '—'} playing now`} />
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
        {runReward ? (
          <div className="absolute inset-x-4 bottom-4 z-20 mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-950/95 p-4 text-white shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">Run complete</div>
                <div className="mt-1 text-2xl font-black">Score {runReward.score}</div>
              </div>
              <button
                type="button"
                onClick={() => setRunReward(null)}
                className="rounded-full border border-white/10 px-3 py-1 text-sm font-bold text-zinc-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xs text-zinc-400">Points earned</div>
                <div className="text-2xl font-black text-white">+{runReward.pointsDelta}</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xs text-zinc-400">Your total</div>
                <div className="text-2xl font-black text-white">{runReward.pointsTotal ?? '—'}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-300">{runReward.message}</p>
            {!pointsEligible && game.slug === 'flappy-dunk' ? (
              <Link href="/streaks" className="mt-3 inline-flex text-sm font-bold text-red-300 hover:text-red-200">
                Go to leaderboard →
              </Link>
            ) : null}
          </div>
        ) : null}
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
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b0b0d]">
      <div className="w-full max-w-sm px-8 text-white">
        <div className="mx-auto mb-6 grid h-16 w-16 grid-cols-2 gap-1 rounded-2xl bg-zinc-900 p-2 shadow-xl ring-1 ring-white/10">
          <span className="rounded-lg bg-red-600" />
          <span className="rounded-lg bg-zinc-700" />
          <span className="rounded-lg bg-zinc-700" />
          <span className="rounded-lg bg-white" />
        </div>
        <div className="text-center">
          <div className="text-xl font-black tracking-tight">{title}</div>
          <div className="mt-1 text-sm font-medium text-zinc-400">Loading playable</div>
        </div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-2/5 animate-[playablesLoad_1.25s_ease-in-out_infinite] rounded-full bg-red-600" />
        </div>
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-500 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
