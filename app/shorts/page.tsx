import { getShortsVideos } from '@/lib/data';
import { ShortsFeed } from '@/components/shorts-feed';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function ShortsPage() {
  const { videos } = await getShortsVideos(1);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <ShortsFeed initialShorts={videos as never[]} currentUserId={user?.id || null} />;
}
