'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Check, Globe, Lock, Plus, X } from 'lucide-react';

type PlaylistRow = {
  id: string;
  title: string;
  is_public: boolean;
  is_watch_later: boolean;
  containsVideo?: boolean;
};

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text || 'Request failed' };
  }
}

export function SaveToPlaylistsButton({
  videoId,
  signedIn,
  variant = 'pill',
}: {
  videoId: string;
  signedIn: boolean;
  variant?: 'pill' | 'rail' | 'menu';
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PlaylistRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPublic, setNewPublic] = useState(false);

  const watchLaterSaved = useMemo(
    () => rows.find((r) => r.is_watch_later)?.containsVideo,
    [rows],
  );

  async function load() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/playlists?videoId=${encodeURIComponent(videoId)}`, {
      cache: 'no-store',
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      setError(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || 'Failed to load playlists.')
          : 'Failed to load playlists.',
      );
      setLoading(false);
      return;
    }
    const list =
      payload && typeof payload === 'object' && 'playlists' in payload
        ? ((payload as { playlists?: unknown }).playlists as PlaylistRow[]) || []
        : [];
    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function toggle(playlistId: string, shouldSave: boolean) {
    setError(null);
    const method = shouldSave ? 'POST' : 'DELETE';
    const res = await fetch(`/api/playlists/${playlistId}/items`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      setError(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || 'Failed to update playlist.')
          : 'Failed to update playlist.',
      );
      return;
    }
    setRows((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, containsVideo: shouldSave } : p)),
    );
  }

  async function createPlaylist() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    setError(null);
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, isPublic: newPublic }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      setError(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || 'Failed to create playlist.')
          : 'Failed to create playlist.',
      );
      setCreating(false);
      return;
    }
    setNewTitle('');
    setNewPublic(false);
    setCreating(false);
    await load();
  }

  return (
    <>
      {variant === 'rail' ? (
        <button
          type="button"
          onClick={() => {
            if (!signedIn) {
              window.location.href = '/sign-in';
              return;
            }
            setOpen(true);
          }}
          className={[
            'pointer-events-auto flex w-16 flex-col items-center gap-1 rounded-2xl p-2 hover:bg-white/10',
            watchLaterSaved ? 'text-red-300' : 'text-white',
          ].join(' ')}
          aria-label="Save"
          title="Save"
        >
          <BookmarkPlus className="h-6 w-6" />
          <span className="text-xs font-semibold">Save</span>
        </button>
      ) : variant === 'menu' ? (
        <button
          type="button"
          onClick={() => {
            if (!signedIn) {
              window.location.href = '/sign-in';
              return;
            }
            setOpen(true);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-100 hover:bg-white/10"
          title="Save to playlist"
        >
          <BookmarkPlus className="h-5 w-5" />
          Save to playlist
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!signedIn) {
              window.location.href = '/sign-in';
              return;
            }
            setOpen(true);
          }}
          className={[
            'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
            'border-zinc-200 bg-white hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900',
            watchLaterSaved ? 'text-red-500' : '',
          ].join(' ')}
          title="Save"
        >
          <BookmarkPlus className="h-4 w-4" />
          Save
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div className="text-sm font-semibold">Save to...</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
              {loading ? (
                <p className="text-sm text-zinc-300">Loading...</p>
              ) : rows.length ? (
                <div className="space-y-2">
                  {rows.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void toggle(p.id, !p.containsVideo)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-semibold">
                            {p.title}
                            {p.is_watch_later ? (
                              <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                                Watch later
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-300">
                          {p.is_public ? (
                            <>
                              <Globe className="h-3.5 w-3.5" /> Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" /> Private
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={[
                          'inline-flex h-8 w-8 items-center justify-center rounded-full border',
                          p.containsVideo
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-zinc-700 bg-black/20 text-zinc-200',
                        ].join(' ')}
                        aria-label={p.containsVideo ? 'Saved' : 'Not saved'}
                      >
                        {p.containsVideo ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-300">No playlists yet.</p>
              )}

              <div className="mt-5 rounded-2xl border border-zinc-800 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> New playlist
                </div>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-500"
                  placeholder="Playlist name"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={newPublic}
                      onChange={(e) => setNewPublic(e.target.checked)}
                      className="h-4 w-4 accent-red-500"
                    />
                    Public
                  </label>
                  <button
                    type="button"
                    onClick={() => void createPlaylist()}
                    disabled={creating || !newTitle.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Create
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 px-5 py-4">
              <div className="text-xs text-zinc-400">
                Public playlists can be viewed by anyone with the link.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
