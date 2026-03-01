import { unstable_cache } from 'next/cache';
import { PAGE_SIZE } from '@/lib/constants';
import { createPublicClient } from '@/lib/supabase/public';

const baseVideoSelect = `
  id,
  user_id,
  title,
  description,
  thumbnail_url,
  video_url,
  tags,
  views,
  created_at,
  profiles:profiles!videos_user_id_fkey (
    id,
    username,
    avatar_url,
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

export async function getVideoById(id: string) {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('videos')
    .select(baseVideoSelect)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getRecommendations(videoId: string, tags: string[]) {
  const supabase = createPublicClient();

  if (!tags.length) return [];

  const { data, error } = await supabase
    .from('videos')
    .select(baseVideoSelect)
    .neq('id', videoId)
    .overlaps('tags', tags)
    .order('views', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
}

export async function getTrendingVideos() {
  const supabase = createPublicClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('videos')
    .select(baseVideoSelect)
    .gte('created_at', since)
    .order('views', { ascending: false })
    .limit(24);

  if (error) throw error;
  return data ?? [];
}
