import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import { PetitionVoteButton } from '@/components/petition-vote-button';

export const runtime = 'edge';

const PETITION_KEY = 'yikes_x_viewtube';

export default async function YikesPetitionPage() {
  const publicClient = createPublicClient();
  const { count } = await publicClient
    .from('petition_votes')
    .select('*', { count: 'exact', head: true })
    .eq('petition_key', PETITION_KEY);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="overflow-hidden rounded-3xl bg-[#02B6F3] text-white">
        <div
          className="relative h-44 bg-cover bg-center sm:h-56"
          style={{ backgroundImage: "url('/yikes-banner.png')" }}
        >
          <div className="absolute inset-0 bg-[#02B6F3]/85" />
          <div className="relative flex h-full flex-col justify-end gap-3 p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/90">Petition</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">yikes x ViewTube</h1>
            <p className="max-w-2xl text-sm text-white/90">
              Tell yikes you want a collab with ViewTube. Each account can sign once.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">What you’re signing</h2>
          <p>
            By signing, you’re telling yikes that you want to see a collaboration with ViewTube.
            Your vote is counted once per account.
          </p>
          <p className="text-xs text-zinc-500">
            ViewTube is an independent platform and is not affiliated with yikes, Google, or YouTube.
          </p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Current votes: {(count || 0).toLocaleString()}
          </p>
        </section>

        <aside className="rounded-2xl bg-[#02B6F3] p-6 text-white">
          {user ? (
            <PetitionVoteButton />
          ) : (
            <div className="space-y-3">
              <Link
                href="/sign-in?redirect=/petition/yikes"
                className="block w-full rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Sign in to sign
              </Link>
              <p className="text-center text-xs text-white/90">
                {(count || 0).toLocaleString()} votes so far
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

