import { getHomeVideos, getPersonalizedHomeVideos } from '@/lib/data';
import { HomeFeed } from '@/components/home-feed';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';

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

  const publicClient = createPublicClient();
  const { count: petitionVotes } = await publicClient
    .from('petition_votes')
    .select('*', { count: 'exact', head: true })
    .eq('petition_key', 'yikes_x_viewtube');

  return (
    <HomeFeed
      initialVideos={videos as never[]}
      initialHasMore={hasMore}
      petitionVotes={petitionVotes || 0}
    />
  );
}
