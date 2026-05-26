import { createPublicClient } from '@/lib/supabase/public';
import { VideoGrid } from '@/components/video-grid';
import Image from 'next/image';
import Link from 'next/link';
import { formatCompactCount } from '@/lib/number';
import { StreakFireBadge } from '@/components/streak-fire-badge';
import { VerifiedBadge } from '@/components/verified-badge';
import { TopStreamerBadge } from '@/components/top-streamer-badge';

export const runtime = 'edge';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() || '';
  const supabase = createPublicClient();

  const [{ data: videos, error }, { data: channels, error: channelError }] = await Promise.all([
    q
      ? supabase.rpc('search_videos', {
          search_query: q,
        })
      : Promise.resolve({ data: [], error: null }),
    q
      ? supabase
          .from('profiles')
          .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,subscribers_count')
          .or(`username.ilike.%${q}%,handle.ilike.%${q}%`)
          .order('subscribers_count', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (error) {
    return <p className="text-sm text-red-500">Search failed: {error.message}</p>;
  }

  if (channelError) {
    return <p className="text-sm text-red-500">Search failed: {channelError.message}</p>;
  }

  return (
    <section>
      <h1 className="mb-5 text-xl font-semibold">Search results for “{q}”</h1>
      {channels?.length ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Channels</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels
              .filter((c) => Boolean(c?.handle))
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/channel/${encodeURIComponent(c.handle as string)}`}
                  className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <Image
                    src={c.avatar_url || '/avatar-placeholder.svg'}
                    alt={c.username || 'Channel'}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <div className="truncate font-semibold group-hover:underline">
                        {c.username || 'unknown'}
                      </div>
                      {c.streak_champion ? <StreakFireBadge className="h-4 w-4" /> : null}
                      {c.verified ? <VerifiedBadge className="h-4 w-4" /> : null}
                      {c.top_streamer ? <TopStreamerBadge className="h-4 w-4" /> : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
                      @{c.handle} • {formatCompactCount(Number(c.subscribers_count || 0))} subscribers
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Videos</h2>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
