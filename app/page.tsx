import Link from 'next/link';
import { getHomeVideos, getPersonalizedHomeVideos } from '@/lib/data';
import { VideoGrid } from '@/components/video-grid';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Number((await searchParams).page || '1');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { videos, hasMore } = user?.id
    ? await getPersonalizedHomeVideos(page, user.id)
    : await getHomeVideos(page);

  return (
    <section>
      <VideoGrid videos={videos as never[]} />

      <div className="mt-8 flex items-center justify-center gap-3">
        {page > 1 && (
          <Link
            href={`/?page=${page - 1}`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Previous
          </Link>
        )}
        {hasMore && (
          <Link
            href={`/?page=${page + 1}`}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
          >
            Load more
          </Link>
        )}
      </div>
    </section>
  );
}
