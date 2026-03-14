import { getHomeVideos, getPersonalizedHomeVideos } from '@/lib/data';
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

  const { videos, hasMore } = user?.id
    ? await getPersonalizedHomeVideos(page, user.id)
    : await getHomeVideos(page);

  return (
    <HomeFeed initialVideos={videos as never[]} initialHasMore={hasMore} />
  );
}
