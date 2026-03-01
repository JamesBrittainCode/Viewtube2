import { createPublicClient } from '@/lib/supabase/public';
import { VideoGrid } from '@/components/video-grid';

export const runtime = 'edge';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() || '';
  const supabase = createPublicClient();

  const { data: videos, error } = q
    ? await supabase.rpc('search_videos', {
        search_query: q,
      })
    : { data: [], error: null };

  if (error) {
    return <p className="text-sm text-red-500">Search failed: {error.message}</p>;
  }

  return (
    <section>
      <h1 className="mb-5 text-xl font-semibold">Search results for “{q}”</h1>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
