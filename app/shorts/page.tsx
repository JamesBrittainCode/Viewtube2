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
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-[520px]">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">ViewTube Shorts</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Vertical videos under 3 minutes.
        </p>
      </div>
      <ShortsFeed initialShorts={videos as never[]} currentUserId={user?.id || null} />
    </div>
  );
}
