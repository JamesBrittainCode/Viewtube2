'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Gamepad2, UploadCloud } from 'lucide-react';

type AdminPlayable = {
  id: string;
  title: string;
  slug: string;
  category: string;
  thumbnail_url?: string | null;
  is_active: boolean;
  plays_count: number;
};

export function AdminPlayablesManager() {
  const [games, setGames] = useState<AdminPlayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadGames() {
    setLoading(true);
    const res = await fetch('/api/admin/playables', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as { games?: AdminPlayable[]; error?: string };
    if (res.ok) setGames(data.games || []);
    else setError(data.error || 'Could not load playables.');
    setLoading(false);
  }

  useEffect(() => {
    void loadGames();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch('/api/admin/playables', { method: 'POST', body: formData });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      form.reset();
      await loadGames();
    } catch (uploadError) {
      setError((uploadError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-red-600 p-3 text-white">
          <Gamepad2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black">Playables</h2>
          <p className="text-sm text-zinc-500">Upload HTML games and thumbnails for the Playables page.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-zinc-100 p-4 dark:bg-zinc-900 md:grid-cols-2">
        <input name="title" required placeholder="Game title" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="slug" placeholder="optional-url-slug" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="category" placeholder="Category, e.g. Puzzle" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="thumbnail" type="file" accept="image/*" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <textarea name="description" placeholder="Short description" className="min-h-24 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 md:col-span-2" />
        <textarea name="instructions" placeholder="Optional notes for players or score-postMessage instructions" className="min-h-20 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 md:col-span-2" />
        <label className="rounded-xl border border-dashed border-zinc-400 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950 md:col-span-2">
          <span className="mb-2 flex items-center gap-2 font-bold">
            <UploadCloud className="h-4 w-4" />
            HTML game file
          </span>
          <input name="html" type="file" accept=".html,.htm,text/html" required />
        </label>
        {error ? <p className="text-sm text-red-500 md:col-span-2">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:opacity-60 md:col-span-2"
        >
          {saving ? 'Uploading playable…' : 'Upload playable'}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {loading ? <p className="text-sm text-zinc-500">Loading games…</p> : null}
        {games.map((game) => (
          <div key={game.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="h-16 w-24 overflow-hidden rounded-xl bg-zinc-900">
              {game.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{game.title}</div>
              <div className="text-xs text-zinc-500">{game.category} · {Number(game.plays_count || 0).toLocaleString()} plays</div>
            </div>
            <Link href={`/playables/${game.slug}`} className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-bold dark:border-zinc-700">
              Open
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
