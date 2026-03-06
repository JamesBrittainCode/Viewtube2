import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { unwrapRelation } from '@/lib/profile';

export const runtime = 'edge';

export default async function LiveDirectoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('live_streams')
    .select('id,title,description,viewer_count,started_at,profiles:profiles!live_streams_user_id_fkey(username,handle,verified)')
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .limit(50);

  const streams = data || [];

  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">Live Now</h1>
      {!streams.length ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          No channels are live right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {streams.map((stream) => {
            const profile = unwrapRelation(stream.profiles);
            return (
              <Link
                key={stream.id}
                href={`/live/${stream.id}`}
                className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  LIVE
                </p>
                <h2 className="mt-2 line-clamp-2 font-semibold">{stream.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {profile?.username || 'Creator'} {profile?.handle ? `(${profile.handle})` : ''}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {Number(stream.viewer_count || 0).toLocaleString()} watching
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{stream.description || 'No description.'}</p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
