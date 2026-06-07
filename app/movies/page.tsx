import { Film } from 'lucide-react';
import { VideoGrid } from '@/components/video-grid';
import { getMoviesVideosByCreator } from '@/lib/data';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Movies' };

const MOVIES_ACCOUNT_EMAIL = 'business@heyrivo.com';

async function findUserIdByEmail(email: string) {
  const adminClient = createAdminClient();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 1000) return null;

    page += 1;
  }

  return null;
}

export default async function MoviesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let videos: Awaited<ReturnType<typeof getMoviesVideosByCreator>> = [];
  let loadError = '';

  try {
    const moviesUserId = await findUserIdByEmail(MOVIES_ACCOUNT_EMAIL);
    videos = moviesUserId ? await getMoviesVideosByCreator(moviesUserId) : [];
  } catch {
    loadError = 'Movies are unavailable right now. Please try again soon.';
  }

  return (
    <section className="space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-red-600 via-zinc-950 to-black p-8 text-white shadow-2xl dark:border-zinc-800 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white/80 ring-1 ring-white/15">
              <Film className="h-4 w-4" />
              ViewTube Movies
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">Movies</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium text-white/70 md:text-base">
              Trailers and film uploads from the official ViewTube business channel.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 text-left ring-1 ring-white/15 md:text-right">
            <div className="text-3xl font-black">{videos.length}</div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/55">Trailers</div>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {loadError}
        </div>
      ) : videos.length ? (
        <VideoGrid videos={videos as never[]} signedIn={Boolean(user)} />
      ) : (
        <div className="rounded-[2rem] border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-800">
          <Film className="mx-auto mb-4 h-10 w-10 text-zinc-500" />
          <h2 className="text-2xl font-black">No movies yet</h2>
          <p className="mt-2 text-sm text-zinc-500">Uploads from {MOVIES_ACCOUNT_EMAIL} will appear here automatically.</p>
        </div>
      )}
    </section>
  );
}
