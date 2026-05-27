'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Film,
  Globe,
  GripVertical,
  ImageIcon,
  LayoutGrid,
  Lock,
  Plus,
  Save,
  Star,
  Trash2,
  Video,
} from 'lucide-react';

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
};

type VideoRow = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  is_short: boolean | null;
  created_at: string;
  views: number | null;
};

type HomeSettings = {
  home_enabled: boolean;
  trailer_video_id: string | null;
  featured_video_id: string | null;
};

type TabSettings = {
  show_home: boolean;
  show_videos: boolean;
  show_shorts: boolean;
  show_playlists: boolean;
};

type SectionType =
  | 'videos'
  | 'popular_videos'
  | 'short_videos'
  | 'single_playlist'
  | 'multiple_playlists'
  | 'live_now';

type HomeSection = {
  id: string;
  section_type: SectionType;
  position: number;
  config: Record<string, unknown>;
};

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text || 'Request failed' };
  }
}

function readStringProp(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function readObjectProp(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>)[key];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function titleForSection(type: SectionType) {
  switch (type) {
    case 'videos':
      return 'Videos';
    case 'popular_videos':
      return 'Popular videos';
    case 'short_videos':
      return 'Short videos';
    case 'single_playlist':
      return 'Single playlist';
    case 'multiple_playlists':
      return 'Multiple playlists';
    case 'live_now':
      return 'Live now';
  }
}

function iconForSection(type: SectionType) {
  switch (type) {
    case 'videos':
    case 'popular_videos':
      return Video;
    case 'short_videos':
      return Film;
    case 'single_playlist':
    case 'multiple_playlists':
      return LayoutGrid;
    case 'live_now':
      return Star;
  }
}

function normalizeSections(list: HomeSection[]) {
  const next = [...list].sort((a, b) => a.position - b.position).map((s, idx) => ({ ...s, position: idx }));
  return next.slice(0, 12);
}

function uuid() {
  return `tmp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function ChannelCustomization({ initialProfile }: { initialProfile: ProfileDraft }) {
  const [topTab, setTopTab] = useState<'profile' | 'home'>('home');

  // Profile/basic + branding
  const [profile, setProfile] = useState<ProfileDraft>(initialProfile);
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [basicOk, setBasicOk] = useState(false);

  // Home tab state
  const [settings, setSettings] = useState<HomeSettings>({
    home_enabled: true,
    trailer_video_id: null,
    featured_video_id: null,
  });
  const [tabSettings, setTabSettings] = useState<TabSettings>({
    show_home: true,
    show_videos: true,
    show_shorts: true,
    show_playlists: true,
  });
  const [sections, setSections] = useState<HomeSection[]>([
    { id: uuid(), section_type: 'videos', position: 0, config: {} },
    { id: uuid(), section_type: 'short_videos', position: 1, config: {} },
    { id: uuid(), section_type: 'multiple_playlists', position: 2, config: {} },
  ]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeSaving, setHomeSaving] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [homeOk, setHomeOk] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  // Add section popover
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement | null>(null);

  const videoById = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!addRef.current) return;
      if (!addRef.current.contains(e.target as Node)) setAddOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  useEffect(() => {
    if (topTab !== 'home') return;
    void (async () => {
      setHomeLoading(true);
      setHomeError(null);
      setHomeOk(false);
      const [sRes, secRes, vidsRes, plsRes] = await Promise.all([
        fetch('/api/channel/customization', { cache: 'no-store' }),
        fetch('/api/channel/home-sections', { cache: 'no-store' }),
        fetch('/api/channel/my-videos', { cache: 'no-store' }),
        fetch('/api/playlists', { cache: 'no-store' }),
      ]);
      const tabsRes = await fetch('/api/channel/tabs', { cache: 'no-store' });
      const sPayload = await safeJson(sRes);
      const secPayload = await safeJson(secRes);
      const vidsPayload = await safeJson(vidsRes);
      const plsPayload = await safeJson(plsRes);
      const tabsPayload = await safeJson(tabsRes);

      if (!sRes.ok) {
        setHomeError(readStringProp(sPayload, 'error') || 'Failed to load customization.');
        setHomeLoading(false);
        return;
      }
      if (!secRes.ok) {
        setHomeError(readStringProp(secPayload, 'error') || 'Failed to load sections.');
        setHomeLoading(false);
        return;
      }
      if (!vidsRes.ok) {
        setHomeError(readStringProp(vidsPayload, 'error') || 'Failed to load videos.');
        setHomeLoading(false);
        return;
      }
      if (!plsRes.ok) {
        setHomeError(readStringProp(plsPayload, 'error') || 'Failed to load playlists.');
        setHomeLoading(false);
        return;
      }
      if (!tabsRes.ok) {
        setHomeError(readStringProp(tabsPayload, 'error') || 'Failed to load tab settings.');
        setHomeLoading(false);
        return;
      }

      const settingsObj = readObjectProp(sPayload, 'settings');
      if (settingsObj) {
        setSettings({
          home_enabled: Boolean(settingsObj.home_enabled ?? true),
          trailer_video_id: typeof settingsObj.trailer_video_id === 'string' ? settingsObj.trailer_video_id : null,
          featured_video_id: typeof settingsObj.featured_video_id === 'string' ? settingsObj.featured_video_id : null,
        });
      }

      const incomingSections =
        secPayload && typeof secPayload === 'object' && 'sections' in secPayload
          ? ((secPayload as { sections?: unknown }).sections as unknown[]) || []
          : [];
      const parsedSections = incomingSections
        .map((row) => {
          const obj = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
          if (!obj) return null;
          const t = String(obj.section_type || 'videos') as SectionType;
          const allowed: SectionType[] = ['videos', 'popular_videos', 'short_videos', 'single_playlist', 'multiple_playlists', 'live_now'];
          if (!allowed.includes(t)) return null;
          return {
            id: String(obj.id || uuid()),
            section_type: t,
            position: Number(obj.position || 0),
            config: (obj.config && typeof obj.config === 'object' ? (obj.config as Record<string, unknown>) : {}) || {},
          } satisfies HomeSection;
        })
        .filter(Boolean) as HomeSection[];
      if (parsedSections.length) setSections(normalizeSections(parsedSections));

      const vids =
        vidsPayload && typeof vidsPayload === 'object' && 'videos' in vidsPayload
          ? (((vidsPayload as { videos?: unknown }).videos as unknown[]) || []) as VideoRow[]
          : [];
      setVideos(vids);

      const pls =
        plsPayload && typeof plsPayload === 'object' && 'playlists' in plsPayload
          ? (((plsPayload as { playlists?: unknown }).playlists as unknown[]) || []) as PlaylistRow[]
          : [];
      setPlaylists(pls.filter((p) => !p.is_watch_later));

      const tabsObj = readObjectProp(tabsPayload, 'tabs');
      if (tabsObj) {
        setTabSettings({
          show_home: Boolean(tabsObj.show_home ?? true),
          show_videos: Boolean(tabsObj.show_videos ?? true),
          show_shorts: Boolean(tabsObj.show_shorts ?? true),
          show_playlists: Boolean(tabsObj.show_playlists ?? true),
        });
      }

      setHomeLoading(false);
    })();
  }, [topTab]);

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
      setBasicError(readStringProp(payload, 'error') || 'Failed to save.');
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
    if (!res.ok) throw new Error(readStringProp(payload, 'error') || 'Upload failed.');
    const key = kind === 'avatar' ? 'avatar_url' : 'banner_url';
    const url = readStringProp(payload, key);
    setProfile((prev) => ({ ...prev, [key]: url || null } as ProfileDraft));
  }

  async function saveHome() {
    setHomeSaving(true);
    setHomeError(null);
    setHomeOk(false);

    if (!tabSettings.show_home && !tabSettings.show_videos && !tabSettings.show_shorts && !tabSettings.show_playlists) {
      setHomeError('At least one tab must be enabled.');
      setHomeSaving(false);
      return;
    }

    const [sRes, secRes, tabsRes] = await Promise.all([
      fetch('/api/channel/customization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeEnabled: settings.home_enabled,
          trailerVideoId: settings.trailer_video_id,
          featuredVideoId: settings.featured_video_id,
        }),
      }),
      fetch('/api/channel/home-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: normalizeSections(sections).map((s) => ({
            section_type: s.section_type,
            position: s.position,
            config: s.config,
          })),
        }),
      }),
      fetch('/api/channel/tabs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showHome: tabSettings.show_home,
          showVideos: tabSettings.show_videos,
          showShorts: tabSettings.show_shorts,
          showPlaylists: tabSettings.show_playlists,
        }),
      }),
    ]);

    const sPayload = await safeJson(sRes);
    const secPayload = await safeJson(secRes);
    const tabsPayload = await safeJson(tabsRes);
    if (!sRes.ok) {
      setHomeError(readStringProp(sPayload, 'error') || 'Failed to save.');
      setHomeSaving(false);
      return;
    }
    if (!secRes.ok) {
      setHomeError(readStringProp(secPayload, 'error') || 'Failed to save sections.');
      setHomeSaving(false);
      return;
    }
    if (!tabsRes.ok) {
      setHomeError(readStringProp(tabsPayload, 'error') || 'Failed to save tab settings.');
      setHomeSaving(false);
      return;
    }

    setHomeOk(true);
    setHomeSaving(false);
  }

  function addSection(type: SectionType) {
    setAddOpen(false);
    setSections((prev) => normalizeSections([...prev, { id: uuid(), section_type: type, position: prev.length, config: {} }]));
  }

  function removeSection(id: string) {
    setSections((prev) => normalizeSections(prev.filter((s) => s.id !== id)));
  }

  function reorderSections(dragId: string, overId: string) {
    if (!dragId || !overId || dragId === overId) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.id === dragId);
      const to = prev.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return normalizeSections(next);
    });
  }

  function updateSectionConfig(id: string, patch: Record<string, unknown>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...patch } } : s)),
    );
  }

  const sectionMenu: Array<{ type: SectionType; label: string }> = [
    { type: 'videos', label: 'Videos' },
    { type: 'popular_videos', label: 'Popular videos' },
    { type: 'short_videos', label: 'Short videos' },
    { type: 'live_now', label: 'Live now' },
    { type: 'single_playlist', label: 'Single playlist' },
    { type: 'multiple_playlists', label: 'Multiple playlists' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Channel customization</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-zinc-400">
          <button
            type="button"
            onClick={() => setTopTab('profile')}
            className={topTab === 'profile' ? 'text-white' : 'hover:text-white'}
          >
            Profile
          </button>
          <span className="text-zinc-700">•</span>
          <button
            type="button"
            onClick={() => setTopTab('home')}
            className={topTab === 'home' ? 'text-white' : 'hover:text-white'}
          >
            Home tab
          </button>
        </div>
      </div>

      {topTab === 'home' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <div>
              <div className="text-sm font-semibold text-white">Home tab</div>
              <div className="mt-1 text-sm text-zinc-400">
                Show your channel home tab to highlight content for your audience.
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <span className="text-zinc-400">Enabled</span>
              <input
                type="checkbox"
                checked={settings.home_enabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, home_enabled: e.target.checked }))}
                className="h-5 w-10 accent-red-500"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Layout</div>
                <div className="mt-1 text-sm text-zinc-400">
                  Customize your channel homepage with up to 12 sections.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveHome()}
                  disabled={homeSaving}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {homeSaving ? 'Saving…' : 'Save'}
                </button>
                <div ref={addRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAddOpen((s) => !s)}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
                  >
                    <Plus className="h-4 w-4" /> Add section <ChevronDown className="h-4 w-4" />
                  </button>
                  {addOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 p-1 text-sm text-zinc-100 shadow-xl">
                      {sectionMenu.map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
                          onClick={() => addSection(item.type)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {homeError ? <p className="mt-3 text-sm text-red-400">{homeError}</p> : null}
            {homeOk ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-300">
                <Check className="h-4 w-4" /> Saved
              </p>
            ) : null}

            {homeLoading ? (
              <p className="mt-4 text-sm text-zinc-400">Loading…</p>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-white">Tabs</div>
                  <div className="mt-1 text-sm text-zinc-400">Choose which tabs show on your channel.</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { key: 'show_home', label: 'Home' },
                        { key: 'show_videos', label: 'Videos' },
                        { key: 'show_shorts', label: 'Shorts' },
                        { key: 'show_playlists', label: 'Playlists' },
                      ] as const
                    ).map((t) => (
                      <label
                        key={t.key}
                        className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200"
                      >
                        <span className="font-semibold">{t.label}</span>
                        <input
                          type="checkbox"
                          checked={tabSettings[t.key]}
                          onChange={(e) =>
                            setTabSettings((prev) => ({ ...prev, [t.key]: e.target.checked } as TabSettings))
                          }
                          className="h-4 w-4 accent-red-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Trailer */}
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Film className="h-4 w-4" /> Channel trailer for people who haven’t subscribed
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-800">
                      {settings.trailer_video_id && videoById.get(settings.trailer_video_id)?.thumbnail_url ? (
                        <Image
                          src={videoById.get(settings.trailer_video_id)?.thumbnail_url || '/thumbnail-placeholder.svg'}
                          alt="Trailer"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">No video</div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      <div className="text-xs text-zinc-400">Video title</div>
                      <select
                        value={settings.trailer_video_id || ''}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, trailer_video_id: e.target.value || null }))
                        }
                        className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white"
                      >
                        <option value="">None</option>
                        {videos
                          .filter((v) => !v.is_short)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Featured */}
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Star className="h-4 w-4" /> Featured video for returning subscribers
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-800">
                      {settings.featured_video_id && videoById.get(settings.featured_video_id)?.thumbnail_url ? (
                        <Image
                          src={videoById.get(settings.featured_video_id)?.thumbnail_url || '/thumbnail-placeholder.svg'}
                          alt="Featured"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-xs text-zinc-400">No video</div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      <div className="text-xs text-zinc-400">Video title</div>
                      <select
                        value={settings.featured_video_id || ''}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, featured_video_id: e.target.value || null }))
                        }
                        className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white"
                      >
                        <option value="">None</option>
                        {videos
                          .filter((v) => !v.is_short)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sections list */}
                {sections.map((s) => {
                  const Icon = iconForSection(s.section_type);
                  const isDragging = draggingSectionId === s.id;
                  const isOver = dragOverSectionId === s.id && draggingSectionId && draggingSectionId !== s.id;
                  return (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingSectionId(s.id);
                        setDragOverSectionId(null);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', s.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggingSectionId && draggingSectionId !== s.id) setDragOverSectionId(s.id);
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDragLeave={() => {
                        if (dragOverSectionId === s.id) setDragOverSectionId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragId = e.dataTransfer.getData('text/plain') || draggingSectionId;
                        if (dragId) reorderSections(dragId, s.id);
                        setDraggingSectionId(null);
                        setDragOverSectionId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingSectionId(null);
                        setDragOverSectionId(null);
                      }}
                      className={[
                        'rounded-2xl border bg-black/20 p-4 transition',
                        isOver ? 'border-red-600' : 'border-zinc-800',
                        isDragging ? 'opacity-70' : '',
                      ].join(' ')}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="cursor-grab rounded-lg p-1 text-zinc-500 hover:bg-white/5 active:cursor-grabbing"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="rounded-xl bg-white/5 p-2 text-zinc-200">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{titleForSection(s.section_type)}</div>
                            <div className="text-xs text-zinc-400">
                              {s.section_type === 'single_playlist'
                                ? 'Choose one playlist to show'
                                : s.section_type === 'multiple_playlists'
                                  ? 'Choose multiple playlists to show'
                                  : 'Section'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeSection(s.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      </div>

                      {s.section_type === 'single_playlist' ? (
                        <div className="mt-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Playlist
                          </div>
                          <select
                            value={typeof s.config.playlistId === 'string' ? s.config.playlistId : ''}
                            onChange={(e) => updateSectionConfig(s.id, { playlistId: e.target.value || null })}
                            className="mt-2 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white"
                          >
                            <option value="">Select a playlist…</option>
                            {playlists.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title} ({p.is_public ? 'Public' : 'Private'})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {s.section_type === 'multiple_playlists' ? (
                        <div className="mt-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Playlists
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {playlists.map((p) => {
                              const selectedIds = Array.isArray(s.config.playlistIds) ? (s.config.playlistIds as unknown[]) : [];
                              const selected = selectedIds.includes(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    const ids = new Set(selectedIds.map((id) => String(id)));
                                    if (ids.has(p.id)) ids.delete(p.id);
                                    else ids.add(p.id);
                                    updateSectionConfig(s.id, { playlistIds: Array.from(ids).slice(0, 12) });
                                  }}
                                  className={[
                                    'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left',
                                    selected ? 'border-red-600 bg-red-600/10' : 'border-zinc-800 bg-zinc-950 hover:bg-white/5',
                                  ].join(' ')}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-white">{p.title}</div>
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
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Preview</div>
                <div className="mt-1 text-sm text-zinc-400">
                  See your channel the way viewers do.
                </div>
              </div>
              <Link
                href={`/channel/${encodeURIComponent(profile.handle || '')}`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800"
              >
                View channel <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white">Branding</h2>
            <p className="mt-1 text-sm text-zinc-400">Choose your profile picture and banner.</p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">Profile picture</div>
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
                <div className="text-sm font-semibold text-white">Banner image</div>
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

          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <h2 className="text-lg font-semibold text-white">Basic info</h2>
            <p className="mt-1 text-sm text-zinc-400">Edit your channel name, handle, and description.</p>

            <form onSubmit={saveBasic} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Channel name</label>
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
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Handle</label>
                <input
                  value={profile.handle}
                  onChange={(e) => setProfile((prev) => ({ ...prev, handle: e.target.value }))}
                  minLength={4}
                  required
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-500"
                  placeholder="@your_handle"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</label>
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
        </div>
      )}
    </div>
  );
}
