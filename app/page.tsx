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

  const [{ videos, hasMore }, { videos: shorts }] = await Promise.all([
    user?.id ? getPersonalizedHomeVideos(page, user.id) : getHomeVideos(page),
    getShortsVideos(1),
  ]);

  return <HomeFeed initialVideos={videos as never[]} initialHasMore={hasMore} initialShorts={shorts.slice(0, 12) as never[]} />;
}
