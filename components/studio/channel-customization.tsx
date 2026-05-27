'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Globe, ImageIcon, Lock, Save } from 'lucide-react';

type ProfileDraft = {
  username: string;
  handle: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
};

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

export function ChannelCustomization({
  initialProfile,
}: {
  initialProfile: ProfileDraft;
}) {
  const [tab, setTab] = useState<'layout' | 'branding' | 'basic'>('layout');

  const [profile, setProfile] = useState<ProfileDraft>(initialProfile);
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [basicOk, setBasicOk] = useState(false);

  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [featured, setFeatured] = useState<string[]>([]);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [layoutOk, setLayoutOk] = useState(false);

  const canSelectPlaylist = useMemo(() => {
    const set = new Set(playlists.filter((p) => !p.is_watch_later).map((p) => p.id));
    return (id: string) => set.has(id);
  }, [playlists]);

  useEffect(() => {
    if (tab !== 'layout') return;
    void (async () => {
      setLayoutLoading(true);
      setLayoutError(null);
      setLayoutOk(false);
      const [pRes, fRes] = await Promise.all([
        fetch('/api/playlists', { cache: 'no-store' }),
        fetch('/api/channel/featured-playlists', { cache: 'no-store' }),
      ]);
      const pPayload = await safeJson(pRes);
      const fPayload = await safeJson(fRes);
      if (!pRes.ok) {
        setLayoutError(
          pPayload && typeof pPayload === 'object' && 'error' in pPayload
            ? String((pPayload as { error?: unknown }).error || 'Failed to load playlists.')
            : 'Failed to load playlists.',
        );
        setLayoutLoading(false);
        return;
      }
      if (!fRes.ok) {
        setLayoutError(
          fPayload && typeof fPayload === 'object' && 'error' in fPayload
            ? String((fPayload as { error?: unknown }).error || 'Failed to load featured playlists.')
            : 'Failed to load featured playlists.',
        );
        setLayoutLoading(false);
        return;
      }

      const list =
        pPayload && typeof pPayload === 'object' && 'playlists' in pPayload
          ? ((pPayload as { playlists?: unknown }).playlists as PlaylistRow[]) || []
          : [];
      const featuredList =
        fPayload && typeof fPayload === 'object' && 'playlists' in fPayload
          ? ((fPayload as { playlists?: unknown }).playlists as Array<{ id: string }>) || []
          : [];

      setPlaylists(list.filter((p) => !p.is_watch_later));
      setFeatured(featuredList.map((p) => p.id).filter(Boolean));
      setLayoutLoading(false);
    })();
  }, [tab]);

  async function saveBasic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    setBasicOk(false);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.username,
        handle: profile.handle,
        bio: profile.bio,
      }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      setBasicError(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || 'Failed to save.')
          : 'Failed to save.',
      );
      setSavingBasic(false);
      return;
    }
    setBasicOk(true);
    setSavingBasic(false);
  }

  async function upload(kind: 'avatar' | 'banner', file: File) {
    const form = new FormData();
    form.set(kind, file);
    const res = await fetch(`/api/profile/${kind}`, { method: 'POST', body: form });
    const payload = await safeJson(res);
    if (!res.ok) {
      throw new Error(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || 'Upload failed.')
          : 'Upload failed.',
      );
    }
    const key = kind === 'avatar' ? 'avatar_url' : 'banner_url';
    const url =
      payload && typeof payload === 'object' && key in payload ? String((payload as any)[key] || '') : '';
    setProfile((prev) => ({ ...prev, [key]: url || null } as ProfileDraft));
  }

  async function saveLayout() {
    setLayoutSaving(true);
    setLayoutError(null);
    setLayoutOk(false);

    const res = await fetch('/api/channel/featured-playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistIds: featured }),
    });
    const payload = await safeJson(res);
    if (!res.ok) {
      setLayoutError(
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error || 'Failed to save.')
          : 'Failed to save.',
      );
      setLayoutSaving(false);
      return;
    }
    setLayoutOk(true);
    setLayoutSaving(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Channel customization</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Customize how your channel looks to viewers and what it features.
          </p>
        </div>
        <Link
          href={`/channel/${encodeURIComponent(profile.handle || '')}`}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
        >
          View channel <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Customization</div>
          <nav className="space-y-1 text-sm">
            {(
              [
                { key: 'layout', label: 'Layout' },
                { key: 'branding', label: 'Branding' },
                { key: 'basic', label: 'Basic info' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={[
                  'w-full rounded-xl px-3 py-2 text-left hover:bg-zinc-800',
                  tab === item.key ? 'bg-zinc-800 text-white' : 'text-zinc-300',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
            Tip: Add playlists to your channel from the Layout tab.
          </div>
        </aside>

        <section className="space-y-4">
          {tab === 'layout' ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Featured sections</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Show playlists on your channel page. Viewers can browse them without leaving your channel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveLayout()}
                  disabled={layoutSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {layoutSaving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {layoutError ? <p className="mt-3 text-sm text-red-400">{layoutError}</p> : null}
              {layoutOk ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-300">
                  <Check className="h-4 w-4" /> Saved
                </p>
              ) : null}

              {layoutLoading ? (
                <p className="mt-4 text-sm text-zinc-400">Loading playlists…</p>
              ) : playlists.length ? (
                <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {playlists.map((p) => {
                    const selected = featured.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (!canSelectPlaylist(p.id)) return;
                          setFeatured((prev) =>
                            prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id].slice(0, 12),
                          );
                        }}
                        className={[
                          'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
                          selected
                            ? 'border-red-600 bg-red-600/10'
                            : 'border-zinc-800 bg-black/20 hover:bg-white/5',
                        ].join(' ')}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">{p.title}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
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
                            'inline-flex h-7 w-7 items-center justify-center rounded-full border',
                            selected ? 'border-red-500 bg-red-600 text-white' : 'border-zinc-700 bg-black/30 text-zinc-300',
                          ].join(' ')}
                        >
                          {selected ? <Check className="h-4 w-4" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/20 p-5 text-sm text-zinc-400">
                  No playlists yet. Click “Save” on a video to create one, then come back here to feature it.
                </div>
              )}

              {featured.length ? (
                <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/20 p-5">
                  <h3 className="text-sm font-semibold text-white">Featured order</h3>
                  <p className="mt-1 text-xs text-zinc-400">Drag ordering is coming soon. Use arrows for now.</p>
                  <div className="mt-4 space-y-2">
                    {featured.map((id, idx) => {
                      const pl = playlists.find((p) => p.id === id);
                      if (!pl) return null;
                      return (
                        <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{pl.title}</div>
                            <div className="mt-0.5 text-xs text-zinc-500">{pl.is_public ? 'Public' : 'Private'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setFeatured((prev) => {
                                  if (idx === 0) return prev;
                                  const next = [...prev];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return next;
                                })
                              }
                              className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold hover:bg-white/10"
                              disabled={idx === 0}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setFeatured((prev) => {
                                  if (idx === prev.length - 1) return prev;
                                  const next = [...prev];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  return next;
                                })
                              }
                              className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold hover:bg-white/10"
                              disabled={idx === featured.length - 1}
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => setFeatured((prev) => prev.filter((pid) => pid !== id))}
                              className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold hover:bg-white/10"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'branding' ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Branding</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Choose the images that represent you across ViewTube.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-sm font-semibold">Profile picture</div>
                  <div className="mt-3 flex items-center gap-4">
                    <Image
                      src={profile.avatar_url || '/avatar-placeholder.svg'}
                      alt="Avatar"
                      width={72}
                      height={72}
                      className="h-18 w-18 rounded-full object-cover"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-white/5">
                      <ImageIcon className="h-4 w-4" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void upload('avatar', file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-sm font-semibold">Banner image</div>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
                    <div className="relative aspect-[16/5] w-full bg-zinc-900">
                      {profile.banner_url ? (
                        <Image src={profile.banner_url} alt="Banner" fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-r from-zinc-700 via-zinc-800 to-zinc-950" />
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-white/5">
                      <ImageIcon className="h-4 w-4" />
                      Upload banner
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void upload('banner', file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'basic' ? (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Basic info</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Edit the details viewers see on your channel page.
              </p>

              <form onSubmit={saveBasic} className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Channel name
                  </label>
                  <input
                    value={profile.username}
                    onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))}
                    minLength={3}
                    required
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-500"
                    placeholder="Channel name"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Handle
                  </label>
                  <input
                    value={profile.handle}
                    onChange={(e) => setProfile((prev) => ({ ...prev, handle: e.target.value }))}
                    minLength={4}
                    required
                    className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-500"
                    placeholder="@your_handle"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Your handle is used in your channel URL.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Description
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                    rows={5}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-white placeholder:text-zinc-500"
                    placeholder="Tell viewers about your channel"
                  />
                </div>

                {basicError ? <p className="text-sm text-red-400">{basicError}</p> : null}
                {basicOk ? (
                  <p className="inline-flex items-center gap-2 text-sm text-emerald-300">
                    <Check className="h-4 w-4" /> Saved
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={savingBasic}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {savingBasic ? 'Saving…' : 'Save'}
                </button>
              </form>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

