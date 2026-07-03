import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { SubscribeButton } from '@/components/subscribe-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { AdminBadge } from '@/components/admin-badge';
import { TopStreamerBadge } from '@/components/top-streamer-badge';
import { StreakFireBadge } from '@/components/streak-fire-badge';
import { VideoGrid } from '@/components/video-grid';
import { ShortsShelf } from '@/components/shorts-shelf';
import { PlaylistCard, type PlaylistCardData } from '@/components/playlist-card';
import { formatCompactCount } from '@/lib/number';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const channelKey = decodeURIComponent(username);
  const publicClient = createPublicClient();

  let { data: channel } = await publicClient.from('profiles').select('*').eq('handle', channelKey).maybeSingle();
  if (!channel) {
    const fallback = await publicClient.from('profiles').select('*').eq('username', channelKey).maybeSingle();
    channel = fallback.data;
  }
  if (!channel) return { title: 'Channel not found' };

  const title = `${channel.username} (${channel.handle})`;
  const description =
    (channel.bio || '').trim() ||
    `Watch videos from ${channel.username} on ViewTube.`;
  const image = channel.avatar_url || '/avatar-placeholder.svg';

  return {
    title,
    description,
    alternates: {
      canonical: `/channel/${channel.handle}`,
    },
    openGraph: {
      title,
      description,
      images: [image],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

function ChannelFeatureVideo({
  label,
  video,
  channelName,
  fallbackImage,
  summary,
}: {
  label: string;
  video: Record<string, unknown>;
  channelName: string;
  fallbackImage?: string | null;
  summary: string;
}) {
  const id = String(video.id || '');
  const title = String(video.title || 'Featured');
  const thumb = typeof video.thumbnail_url === 'string' ? video.thumbnail_url : null;
  const createdAt = typeof video.created_at === 'string' ? video.created_at : '';
  const views = Number(video.views || 0);

  if (!id) return null;

  return (
    <section className="mt-6 border-b border-zinc-200 pb-8 dark:border-zinc-800">
      <h2 className="mb-4 text-lg font-semibold">{label}</h2>
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,520px)_minmax(0,1fr)] lg:items-start">
        <Link
          href={`/watch/${id}`}
          className="group relative block overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-900"
        >
          <div className="relative aspect-video w-full">
            <Image
              src={thumb || fallbackImage || '/thumbnail-placeholder.svg'}
              alt={title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 520px"
              priority
            />
          </div>
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/70 text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-current" />
            </span>
          </span>
        </Link>
        <div className="max-w-2xl">
          <Link href={`/watch/${id}`} className="text-xl font-bold leading-tight hover:underline">
            {title}
          </Link>
          <p className="mt-2 text-sm text-zinc-500">
            {channelName}
            {createdAt ? (
              <>
                {' '}
                · {views.toLocaleString()} views · {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
              </>
            ) : null}
          </p>
          <p className="mt-4 line-clamp-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {summary}
          </p>
          <Link
            href={`/watch/${id}`}
            className="mt-5 inline-flex items-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Watch now
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const channelKey = decodeURIComponent(username);
  const requestedTab = (await searchParams)?.tab ? String((await searchParams)?.tab || '') : '';
  const publicClient = createPublicClient();

  let { data: channel, error } = await publicClient
    .from('profiles')
    .select('*')
    .eq('handle', channelKey)
    .single();

  if (error || !channel) {
    const fallback = await publicClient
      .from('profiles')
      .select('*')
      .eq('username', channelKey)
      .single();
    channel = fallback.data;
    error = fallback.error;
  }

  if (error || !channel) notFound();
  if (channel.handle !== channelKey) {
    redirect(`/channel/${channel.handle}`);
  }

  const { data: liveStream } = await publicClient
    .from('live_streams')
    .select('id,title,description,thumbnail_url,viewer_count,started_at,is_live')
    .eq('user_id', channel.id)
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .maybeSingle();

  const { data: videos } = await publicClient
    .from('videos')
    .select(
      'id,title,thumbnail_url,views,created_at,is_short,profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified,is_admin,top_streamer,streak_champion)'
    )
    .eq('user_id', channel.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false });

  const normalVideos = (videos || []).filter((v) => !v.is_short);
  const shorts = (videos || []).filter((v) => v.is_short);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = Boolean(user?.id && user.id === channel.id);
  const featuredClient = isOwner ? supabase : publicClient;

  const { data: tabSettings, error: tabError } = await featuredClient
    .from('channel_tab_settings')
    .select('show_home,show_videos,show_shorts,show_playlists')
    .eq('user_id', channel.id)
    .maybeSingle();

  const tabs = {
    show_home: tabError ? true : (tabSettings?.show_home ?? true),
    show_videos: tabError ? true : (tabSettings?.show_videos ?? true),
    show_shorts: tabError ? true : (tabSettings?.show_shorts ?? true),
    show_playlists: tabError ? true : (tabSettings?.show_playlists ?? true),
  };

  const visibleTabs = [
    tabs.show_home ? ('home' as const) : null,
    tabs.show_videos ? ('videos' as const) : null,
    tabs.show_shorts ? ('shorts' as const) : null,
    tabs.show_playlists ? ('playlists' as const) : null,
  ].filter(Boolean) as Array<'home' | 'videos' | 'shorts' | 'playlists'>;

  function isValidTab(value: string): value is 'home' | 'videos' | 'shorts' | 'playlists' {
    return value === 'home' || value === 'videos' || value === 'shorts' || value === 'playlists';
  }

  const activeTab =
    isValidTab(requestedTab) && visibleTabs.includes(requestedTab)
      ? requestedTab
      : visibleTabs[0] || 'videos';

  const [{ data: homeSettings }, { data: homeSections }] = await Promise.all([
    featuredClient
      .from('channel_home_settings')
      .select('home_enabled,trailer_video_id,featured_video_id')
      .eq('user_id', channel.id)
      .maybeSingle(),
    featuredClient
      .from('channel_home_sections')
      .select('id,section_type,config,position')
      .eq('user_id', channel.id)
      .order('position', { ascending: true })
      .limit(12),
  ]);

  const homeEnabled = homeSettings?.home_enabled !== false;
  const sections =
    (homeSections || [])
      .map((s) => ({
        id: String((s as { id?: unknown }).id || ''),
        section_type: String((s as { section_type?: unknown }).section_type || 'videos'),
        config:
          (s as { config?: unknown }).config && typeof (s as { config?: unknown }).config === 'object'
            ? ((s as { config?: unknown }).config as Record<string, unknown>)
            : {},
      }))
      .filter((s) => Boolean(s.id)) || [];
  const { data: featuredRows } = await featuredClient
    .from('channel_featured_playlists')
    .select(
      `
        position,
        playlist:playlists!channel_featured_playlists_playlist_id_fkey(
          id,title,is_public,is_watch_later,updated_at
        )
      `,
    )
    .eq('user_id', channel.id)
    .order('position', { ascending: true });

  const featuredPlaylists = (featuredRows || [])
    .map((row) => (row as unknown as { playlist?: Record<string, unknown> | null }).playlist)
    .filter(Boolean) as Array<Record<string, unknown>>;

  const featuredIds = featuredPlaylists.map((p) => String(p.id));
  const { data: featuredItems } = featuredIds.length
    ? await featuredClient
        .from('playlist_items')
        .select('playlist_id,created_at,video:videos(thumbnail_url)')
        .in('playlist_id', featuredIds)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] as unknown[] };

  const playlistCount = new Map<string, number>();
  const playlistCover = new Map<string, string | null>();
  (featuredItems || []).forEach((row) => {
    const playlistId = String((row as { playlist_id?: unknown }).playlist_id || '');
    if (!playlistId) return;
    playlistCount.set(playlistId, (playlistCount.get(playlistId) || 0) + 1);
    if (!playlistCover.has(playlistId)) {
      const videoRelation = (
        row as unknown as {
          video?: { thumbnail_url?: string | null }[] | { thumbnail_url?: string | null } | null;
        }
      ).video;
      const url = Array.isArray(videoRelation)
        ? videoRelation[0]?.thumbnail_url ?? null
        : videoRelation?.thumbnail_url ?? null;
      playlistCover.set(playlistId, url);
    }
  });

  const featuredCards: PlaylistCardData[] = featuredPlaylists
    .filter((p) => !Boolean(p.is_watch_later))
    .map((p) => ({
      id: String(p.id),
      title: String(p.title || 'Playlist'),
      is_public: Boolean(p.is_public),
      updated_at: String(p.updated_at || ''),
      videoCount: playlistCount.get(String(p.id)) || 0,
      coverThumbnailUrl: playlistCover.get(String(p.id)) ?? null,
    }));

  let subscribed = false;

  if (user) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('creator_id', channel.id)
      .maybeSingle();
    subscribed = Boolean(data);
  }

  const featuredVideoIds = [homeSettings?.trailer_video_id, homeSettings?.featured_video_id]
    .filter(Boolean)
    .map((id) => String(id));
  const { data: featuredVideos } = featuredVideoIds.length
    ? await featuredClient
        .from('videos')
        .select('id,user_id,title,thumbnail_url,views,created_at,is_short')
        .eq('user_id', channel.id)
        .eq('is_removed', false)
        .in('id', featuredVideoIds)
    : { data: [] as unknown[] };

  const featuredVideoById = new Map(
    (featuredVideos || []).map((v) => [String((v as { id?: unknown }).id || ''), v as Record<string, unknown>]),
  );

  async function buildPlaylistCards(playlistIds: string[]): Promise<PlaylistCardData[]> {
    const unique = Array.from(new Set(playlistIds.map(String))).filter(Boolean);
    if (!unique.length) return [];

    const { data: pls } = await featuredClient
      .from('playlists')
      .select('id,title,is_public,is_watch_later,updated_at')
      .eq('user_id', channel.id)
      .in('id', unique);

    const playlists = (pls || [])
      .filter((p) => !Boolean((p as { is_watch_later?: unknown }).is_watch_later))
      .map((p) => ({
        id: String((p as { id?: unknown }).id || ''),
        title: String((p as { title?: unknown }).title || 'Playlist'),
        is_public: Boolean((p as { is_public?: unknown }).is_public),
        updated_at: String((p as { updated_at?: unknown }).updated_at || ''),
      }));

    const { data: items } = playlists.length
      ? await featuredClient
          .from('playlist_items')
          .select('playlist_id,created_at,video:videos(thumbnail_url)')
          .in(
            'playlist_id',
            playlists.map((p) => p.id),
          )
          .order('created_at', { ascending: false })
          .limit(800)
      : { data: [] as unknown[] };

    const countBy = new Map<string, number>();
    const coverBy = new Map<string, string | null>();
    (items || []).forEach((row) => {
      const playlistId = String((row as { playlist_id?: unknown }).playlist_id || '');
      if (!playlistId) return;
      countBy.set(playlistId, (countBy.get(playlistId) || 0) + 1);
      if (!coverBy.has(playlistId)) {
        const videoRelation = (
          row as unknown as {
            video?: { thumbnail_url?: string | null }[] | { thumbnail_url?: string | null } | null;
          }
        ).video;
        const url = Array.isArray(videoRelation)
          ? videoRelation[0]?.thumbnail_url ?? null
          : videoRelation?.thumbnail_url ?? null;
        coverBy.set(playlistId, url);
      }
    });

    const order = new Map(unique.map((id, idx) => [id, idx]));
    return playlists
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((p) => ({
        id: p.id,
        title: p.title,
        is_public: p.is_public,
        updated_at: p.updated_at,
        videoCount: countBy.get(p.id) || 0,
        coverThumbnailUrl: coverBy.get(p.id) ?? null,
      }));
  }

  const cardsBySection = new Map<string, PlaylistCardData[]>();
  for (const s of sections) {
    if (s.section_type === 'single_playlist') {
      const id = typeof s.config.playlistId === 'string' ? s.config.playlistId : '';
      if (id) cardsBySection.set(s.id, await buildPlaylistCards([id]));
    }
    if (s.section_type === 'multiple_playlists') {
      const ids = Array.isArray(s.config.playlistIds) ? s.config.playlistIds.map(String) : [];
      if (ids.length) cardsBySection.set(s.id, await buildPlaylistCards(ids));
    }
  }

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: channel.username,
            identifier: channel.handle,
            image: channel.avatar_url || undefined,
            description: channel.bio || undefined,
            url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/channel/${channel.handle}`,
          }),
        }}
      />
      <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
        {channel.banner_url && (
          <Image src={channel.banner_url} alt={channel.username} fill className="object-cover" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={[
              'relative h-20 w-20 rounded-full',
              liveStream?.id
                ? 'ring-4 ring-red-500 ring-offset-4 ring-offset-white dark:ring-offset-zinc-950'
                : '',
            ].join(' ')}
          >
            <Image
              src={channel.avatar_url || '/avatar-placeholder.svg'}
              alt={channel.username}
              width={84}
              height={84}
              className="h-20 w-20 rounded-full object-cover"
            />
            {liveStream?.id ? (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                LIVE
              </span>
            ) : null}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold">{channel.username}</h1>
              {channel.streak_champion ? <StreakFireBadge className="h-5 w-5" /> : null}
              {channel.verified && <VerifiedBadge className="h-5 w-5" />}
              {channel.is_admin && <AdminBadge className="h-5 w-5" />}
              {channel.top_streamer && <TopStreamerBadge className="h-5 w-5" />}
            </div>
            <p className="text-sm text-zinc-500">
              {formatCompactCount(channel.subscribers_count)} subscribers
            </p>
            {channel.bio && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{channel.bio}</p>}
          </div>
        </div>

        {user && user.id !== channel.id && (
          <SubscribeButton
            creatorId={channel.id}
            initialSubscribed={subscribed}
            initialCount={channel.subscribers_count}
          />
        )}
      </div>

      {/* Channel tabs */}
      {visibleTabs.length ? (
        <div className="mt-6 border-b border-zinc-200 dark:border-zinc-800">
          <nav className="flex items-center gap-6 overflow-x-auto pb-2 text-sm font-semibold">
            {visibleTabs.map((tab) => {
              const label =
                tab === 'home'
                  ? 'Home'
                  : tab === 'videos'
                    ? 'Videos'
                    : tab === 'shorts'
                      ? 'Shorts'
                      : 'Playlists';
              const href = `/channel/${encodeURIComponent(channel.handle)}?tab=${tab}`;
              const isActive = tab === activeTab;
              return (
                <Link
                  key={tab}
                  href={href}
                  className={[
                    'shrink-0 pb-2',
                    isActive
                      ? 'border-b-2 border-white text-white dark:border-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
                  ].join(' ')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      {/* Trailer / featured videos */}
      {activeTab === 'home' && homeEnabled && homeSettings?.trailer_video_id && !subscribed ? (
        <ChannelFeatureVideo
          label="Channel trailer"
          video={featuredVideoById.get(String(homeSettings.trailer_video_id || '')) || {}}
          channelName={channel.username}
          fallbackImage={channel.banner_url}
          summary={(channel.bio || '').trim() || `Welcome to ${channel.username}. Watch the latest videos, shorts, and playlists from this channel.`}
        />
      ) : null}

      {activeTab === 'home' && homeEnabled && homeSettings?.featured_video_id && subscribed ? (
        <ChannelFeatureVideo
          label="Featured for returning subscribers"
          video={featuredVideoById.get(String(homeSettings.featured_video_id || '')) || {}}
          channelName={channel.username}
          fallbackImage={channel.banner_url}
          summary={`Welcome back to ${channel.username}. Here’s a featured video picked for subscribers.`}
        />
      ) : null}

      {/* Live now card shows here only if not configured as a section */}
      {activeTab === 'home' &&
      (!homeEnabled || !sections.some((s) => s.section_type === 'live_now')) &&
      liveStream?.id ? (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Live now</h2>
          <Link
            href={`/live/${liveStream.id}`}
            className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-800">
              <Image
                src={liveStream.thumbnail_url || channel.banner_url || '/thumbnail-placeholder.svg'}
                alt={liveStream.title || 'Live stream'}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 900px"
                priority
              />
              <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                LIVE
              </span>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                {Number(liveStream.viewer_count || 0).toLocaleString()} watching
              </span>
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 text-base font-semibold group-hover:underline">
                {liveStream.title || 'Live Stream'}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Started {formatDistanceToNow(new Date(liveStream.started_at), { addSuffix: true })}
              </p>
              {liveStream.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {liveStream.description}
                </p>
              ) : null}
            </div>
          </Link>
        </div>
      ) : null}

      {activeTab === 'home' && homeEnabled && sections.length ? (
        <div className="mt-8 space-y-8">
          {sections.map((s) => {
            if (s.section_type === 'live_now') {
              if (!liveStream?.id) return null;
              return (
                <div key={s.id}>
                  <h2 className="mb-3 text-lg font-semibold">Live now</h2>
                  <Link
                    href={`/live/${liveStream.id}`}
                    className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-800">
                      <Image
                        src={liveStream.thumbnail_url || channel.banner_url || '/thumbnail-placeholder.svg'}
                        alt={liveStream.title || 'Live stream'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 900px"
                      />
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        LIVE
                      </span>
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                        {Number(liveStream.viewer_count || 0).toLocaleString()} watching
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 text-base font-semibold group-hover:underline">
                        {liveStream.title || 'Live Stream'}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Started {formatDistanceToNow(new Date(liveStream.started_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            }

            if (s.section_type === 'short_videos') {
              if (!shorts.length) return null;
              return (
                <div key={s.id}>
                  <h2 className="mb-4 text-lg font-semibold">Short videos</h2>
                  <ShortsShelf shorts={(shorts as never[]).slice(0, 18)} />
                </div>
              );
            }

            if (s.section_type === 'videos') {
              return (
                <div key={s.id}>
                  <h2 className="mb-5 text-lg font-semibold">Videos</h2>
                  <VideoGrid videos={(normalVideos || []).slice(0, 24) as never[]} />
                </div>
              );
            }

            if (s.section_type === 'popular_videos') {
              const popular = [...(normalVideos || [])]
                .sort((a, b) => (b.views || 0) - (a.views || 0))
                .slice(0, 24);
              if (!popular.length) return null;
              return (
                <div key={s.id}>
                  <h2 className="mb-5 text-lg font-semibold">Popular videos</h2>
                  <VideoGrid videos={popular as never[]} />
                </div>
              );
            }

            if (s.section_type === 'single_playlist') {
              const cards = cardsBySection.get(s.id) || [];
              if (!cards.length) return null;
              return (
                <div key={s.id}>
                  <h2 className="mb-4 text-lg font-semibold">{cards[0].title}</h2>
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
                    <PlaylistCard playlist={cards[0]} />
                  </div>
                </div>
              );
            }

            if (s.section_type === 'multiple_playlists') {
              const cards = cardsBySection.get(s.id) || featuredCards;
              if (!cards.length) return null;
              return (
                <div key={s.id}>
                  <h2 className="mb-4 text-lg font-semibold">Playlists</h2>
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map((p) => (
                      <PlaylistCard key={p.id} playlist={p} />
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      ) : (
        <>
          {activeTab === 'home' && shorts.length ? (
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">Shorts</h2>
              <ShortsShelf shorts={(shorts as never[]).slice(0, 18)} />
            </div>
          ) : null}

          {activeTab === 'home' && featuredCards.length ? (
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">Playlists</h2>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
                {featuredCards.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} />
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === 'home' ? (
            <>
              <h2 className="mb-5 mt-8 text-lg font-semibold">Videos</h2>
              <VideoGrid videos={(normalVideos || []) as never[]} />
            </>
          ) : null}
        </>
      )}

      {activeTab === 'videos' ? (
        <div className="mt-6">
          <VideoGrid videos={(normalVideos || []) as never[]} />
        </div>
      ) : null}

      {activeTab === 'shorts' ? (
        <div className="mt-6">
          {shorts.length ? <ShortsShelf shorts={(shorts as never[]).slice(0, 60)} /> : null}
        </div>
      ) : null}

      {activeTab === 'playlists' ? (
        <div className="mt-6">
          {featuredCards.length ? (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
              {featuredCards.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              No playlists to show yet.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
