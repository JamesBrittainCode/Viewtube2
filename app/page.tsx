import { getHomeVideos, getPersonalizedHomeVideos, getShortsVideos } from '@/lib/data';
import { HomeFeed } from '@/components/home-feed';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Ignore ?page=... for the homepage feed (we load more in-page instead of navigating).
  await searchParams;
  const page = 1;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ videos, hasMore }, { videos: shorts }, { data: bannerAds }] = await Promise.all([
    user?.id ? getPersonalizedHomeVideos(page, user.id) : getHomeVideos(page),
    getShortsVideos(1),
    supabase
      .from('banner_ads')
      .select('id,title,image_url,click_url,starts_at,ends_at')
      .eq('placement', 'home_top')
      .eq('approved', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const now = Date.now();
  const homeBannerAd =
    (bannerAds || []).find((item) => {
      const starts = 'starts_at' in item && item.starts_at ? new Date(item.starts_at as string).getTime() : null;
      const ends = 'ends_at' in item && item.ends_at ? new Date(item.ends_at as string).getTime() : null;
      if (starts && now < starts) return false;
      if (ends && now >= ends) return false;
      return true;
    }) || null;

  return (
    <HomeFeed
      initialVideos={videos as never[]}
      initialHasMore={hasMore}
      initialShorts={shorts.slice(0, 12) as never[]}
      homeBannerAd={homeBannerAd}
      signedIn={Boolean(user)}
    />
  );
}
