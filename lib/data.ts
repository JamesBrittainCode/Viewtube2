import { unstable_cache } from 'next/cache';
import { PAGE_SIZE } from '@/lib/constants';
import { createPublicClient } from '@/lib/supabase/public';

const baseVideoSelect = `
  id,
  user_id,
  title,
  description,
  visibility,
  comments_enabled,
  thumbnail_url,
  video_url,
  duration_seconds,
  is_short,
  video_width,
  video_height,
  tags,
  views,
  created_at,
  profiles:profiles!videos_user_id_fkey (
    id,
    username,
    handle,
    avatar_url,
    verified,
    is_admin,
    top_streamer,
    streak_champion,
    subscribers_count
  )
`;

export const getHomeVideos = unstable_cache(
  async (page: number) => {
    const supabase = createPublicClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('videos')
      .select(baseVideoSelect, { count: 'exact' })
      .eq('is_removed', false)
      .eq('visibility', 'public')
      .eq('is_short', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      videos: data ?? [],
      hasMore: (count ?? 0) > page * PAGE_SIZE,
    };
  },
  ['home-videos'],
  { revalidate: 60 },
);

function scoreVideoForUser(
  video: { id: string; user_id: string; tags?: string[] | null; views?: number; created_at: string },
  context: {
    subscribedCreatorIds: Set<string>;
    tagWeights: Map<string, number>;
    interactedVideoIds: Set<string>;
    watchedVideoIds: Set<string>;
  },
) {
  let score = 0;

  if (context.subscribedCreatorIds.has(video.user_id)) score += 95;
  if (context.watchedVideoIds.has(video.id)) score -= 35;
  if (context.interactedVideoIds.has(video.id)) score -= 18;

  for (const tag of video.tags || []) {
    score += (context.tagWeights.get(tag) || 0) * 6;
  }

  const ageDays = Math.max(
    0,
    (Date.now() - new Date(video.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  score += Math.max(0, 28 - ageDays * 1.1);
  score += Math.log10((video.views || 0) + 1) * 5;

  return score;
}

function personalizeVideoReason(
  video: { user_id: string; tags?: string[] | null; views?: number },
  context: {
    subscribedCreatorIds: Set<string>;
    tagWeights: Map<string, number>;
  },
) {
  if (context.subscribedCreatorIds.has(video.user_id)) return 'From your subscriptions';
  const matchedTag = (video.tags || [])
    .map((tag) => ({ tag, weight: context.tagWeights.get(tag) || 0 }))
    .sort((a, b) => b.weight - a.weight)[0];
  if (matchedTag?.weight) return `Because you watch ${matchedTag.tag}`;
  if ((video.views || 0) >= 100) return 'Trending on ViewTube';
  return 'Fresh pick for you';
}

export async function getPersonalizedHomeVideos(page: number, userId: string) {
  const supabase = createPublicClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [subsRes, likesRes, commentsRes, watchSignalsRes] = await Promise.all([
    supabase.from('subscriptions').select('creator_id').eq('subscriber_id', userId).limit(250),
    supabase.from('likes').select('video_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(120),
    supabase.from('comments').select('video_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(120),
    supabase
      .from('viewtube_activity_awards')
      .select('target_id,created_at')
      .eq('user_id', userId)
      .eq('activity_type', 'watch_signal')
      .order('created_at', { ascending: false })
      .limit(180),
  ]);

  const subscriptions = subsRes.data || [];
  const likes = likesRes.data || [];
  const comments = commentsRes.data || [];
  const watchSignals = watchSignalsRes.data || [];

  const subscribedCreatorIds = new Set(subscriptions.map((row) => row.creator_id));
  const likedVideoIds = likes.map((row) => row.video_id);
  const commentedVideoIds = comments.map((row) => row.video_id);
  const watchedVideoIds = watchSignals.map((row) => row.target_id);
  const interactedVideoIds = new Set([...likedVideoIds, ...commentedVideoIds]);

  const activityVideoIds = Array.from(new Set([...likedVideoIds, ...commentedVideoIds, ...watchedVideoIds])).slice(0, 240);
  let tagWeights = new Map<string, number>();

  if (activityVideoIds.length) {
    const { data: activityVideos } = await supabase
      .from('videos')
      .select('id,tags')
      .in('id', activityVideoIds)
        .eq('is_removed', false)
        .eq('visibility', 'public')
        .limit(200);

    const rankedIds = [...likedVideoIds, ...commentedVideoIds, ...watchedVideoIds];
    const recencyRank = new Map<string, number>();
    rankedIds.forEach((id, index) => {
      if (!recencyRank.has(id)) recencyRank.set(id, index);
    });

    tagWeights = new Map<string, number>();
    for (const item of activityVideos || []) {
      const rank = recencyRank.get(item.id) ?? 999;
      const interactionBoost = interactedVideoIds.has(item.id) ? 4 : 0;
      const rankWeight = Math.max(1, 12 - Math.floor(rank / 10)) + interactionBoost;
      for (const tag of item.tags || []) {
        tagWeights.set(tag, (tagWeights.get(tag) || 0) + rankWeight);
      }
    }
  }

  const topTags = Array.from(tagWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const [subscribedVideosRes, tagVideosRes, trendingRes] = await Promise.all([
    subscribedCreatorIds.size
      ? supabase
          .from('videos')
          .select(baseVideoSelect)
          .in('user_id', Array.from(subscribedCreatorIds))
          .eq('is_removed', false)
          .eq('visibility', 'public')
          .eq('is_short', false)
          .order('created_at', { ascending: false })
          .limit(250)
      : Promise.resolve({ data: [], error: null }),
    topTags.length
      ? supabase
          .from('videos')
          .select(baseVideoSelect)
          .overlaps('tags', topTags)
          .eq('is_removed', false)
          .eq('visibility', 'public')
          .eq('is_short', false)
          .order('views', { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('videos')
      .select(baseVideoSelect)
      .eq('is_removed', false)
      .eq('visibility', 'public')
      .eq('is_short', false)
      .order('views', { ascending: false })
      .limit(200),
  ]);

  if (subscribedVideosRes.error) throw subscribedVideosRes.error;
  if (tagVideosRes.error) throw tagVideosRes.error;
  if (trendingRes.error) throw trendingRes.error;

  const merged = [
    ...(subscribedVideosRes.data || []),
    ...(tagVideosRes.data || []),
    ...(trendingRes.data || []),
  ];

  if (!merged.length) return getHomeVideos(page);

  const deduped = new Map<string, (typeof merged)[number]>();
  for (const row of merged) {
    if (!deduped.has(row.id)) deduped.set(row.id, row);
  }

  const ranked = Array.from(deduped.values()).sort((a, b) => {
    const watchedSet = new Set(watchedVideoIds);
    const scoreA = scoreVideoForUser(a, { subscribedCreatorIds, tagWeights, interactedVideoIds, watchedVideoIds: watchedSet });
    const scoreB = scoreVideoForUser(b, { subscribedCreatorIds, tagWeights, interactedVideoIds, watchedVideoIds: watchedSet });
    return scoreB - scoreA;
  });

  return {
    videos: ranked.slice(from, to + 1).map((video) => ({
      ...video,
      feed_reason: personalizeVideoReason(video, { subscribedCreatorIds, tagWeights }),
    })),
    hasMore: ranked.length > page * PAGE_SIZE,
  };
}

export async function getVideoById(id: string) {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('videos')
    .select(baseVideoSelect)
    .eq('id', id)
    .eq('is_removed', false)
    .single();

  if (error) throw error;
  return data;
}

export async function getRecommendations(videoId: string, tags: string[]) {
  const supabase = createPublicClient();

  const query = supabase
      .from('videos')
      .select(baseVideoSelect)
      .neq('id', videoId)
      .eq('is_removed', false)
      .eq('visibility', 'public')
      .eq('is_short', false);

  const { data, error } = tags.length
    ? await query.overlaps('tags', tags).order('views', { ascending: false }).limit(12)
    : await query.order('views', { ascending: false }).limit(12);

  if (error) throw error;
  return data ?? [];
}

export async function getTrendingVideos() {
  const supabase = createPublicClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('videos')
    .select(baseVideoSelect)
    .eq('is_removed', false)
    .eq('visibility', 'public')
    .eq('is_short', false)
    .gte('created_at', since)
    .order('views', { ascending: false })
    .limit(24);

  if (error) throw error;
  return data ?? [];
}

export async function getMoviesVideosByCreator(userId: string) {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('videos')
    .select(baseVideoSelect)
    .eq('user_id', userId)
    .eq('is_removed', false)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(72);

  if (error) throw error;
  return data ?? [];
}

export const getShortsVideos = unstable_cache(
  async (page: number) => {
    const supabase = createPublicClient();
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('videos')
      .select(baseVideoSelect, { count: 'exact' })
      .eq('is_removed', false)
      .eq('visibility', 'public')
      .eq('is_short', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      videos: data ?? [],
      hasMore: (count ?? 0) > page * PAGE_SIZE,
    };
  },
  ['shorts-videos'],
  { revalidate: 30 },
);
