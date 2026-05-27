import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type PlaylistRow = {
  id: string;
  title: string;
  is_public: boolean;
  is_watch_later: boolean;
  updated_at: string;
};

export default async function PlaylistsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: playlists } = await supabase
    .from('playlists')
    .select('id,title,is_public,is_watch_later,updated_at')
    .eq('user_id', user.id)
    .order('is_watch_later', { ascending: false })
    .order('updated_at', { ascending: false });

  const list = (playlists || []) as PlaylistRow[];
  const watchLater = list.find((p) => p.is_watch_later);
  const others = list.filter((p) => !p.is_watch_later);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Playlists</h1>
        {watchLater ? (
          <Link
            href="/watch-later"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Watch later
          </Link>
        ) : null}
      </div>

      {others.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {others.map((p) => (
            <Link
              key={p.id}
              href={`/playlists/${p.id}`}
              className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold group-hover:underline">{p.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">{p.is_public ? 'Public' : 'Private'}</div>
                </div>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    p.is_public
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
                  ].join(' ')}
                >
                  {p.is_public ? 'Public' : 'Private'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          No playlists yet. Click “Save” on any video to create one.
        </div>
      )}
    </section>
  );
}

