import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { StreakFireBadge } from '@/components/streak-fire-badge';
import { VerifiedBadge } from '@/components/verified-badge';
import { TopStreamerBadge } from '@/components/top-streamer-badge';

export const runtime = 'edge';

type Row = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  profiles?: {
    username?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
    verified?: boolean | null;
    top_streamer?: boolean | null;
  } | null;
};

export default async function StreaksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: myStreak }, { data: leaderboard }] = await Promise.all([
    user
      ? supabase
          .from('viewtube_streaks')
          .select('user_id,current_streak,longest_streak,last_active_date')
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('viewtube_streaks')
      .select(
        'user_id,current_streak,longest_streak,last_active_date,profiles:profiles!viewtube_streaks_user_id_fkey(username,handle,avatar_url,verified,top_streamer)',
      )
      .order('current_streak', { ascending: false })
      .order('longest_streak', { ascending: false })
      .order('last_active_date', { ascending: false })
      .limit(50),
  ]);

  const rows = (leaderboard || []) as Row[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">ViewTube Streak</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Keep a streak by logging in and doing at least one interaction per day (comment, like, subscribe, upload, go
          live).
        </p>

        {user ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Current</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {myStreak?.current_streak ?? 0} day{(myStreak?.current_streak ?? 0) === 1 ? '' : 's'}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Best</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {myStreak?.longest_streak ?? 0} day{(myStreak?.longest_streak ?? 0) === 1 ? '' : 's'}
              </div>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Last active:{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {myStreak?.last_active_date ?? '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/sign-in" className="font-semibold text-zinc-900 underline dark:text-white">
              Sign in
            </Link>{' '}
            to track your streak.
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Streak Leaderboard</h2>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.length ? (
            rows.map((row, index) => {
              const profile = row.profiles || {};
              const handle = profile.handle || null;
              const isChampion = index === 0;
              return (
                <div key={row.user_id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-8 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    #{index + 1}
                  </div>
                  <Image
                    src={profile.avatar_url || '/avatar-placeholder.svg'}
                    alt={profile.username || profile.handle || 'User'}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {profile.username || (handle ? `@${handle}` : 'User')}
                      </div>
                      {isChampion && <StreakFireBadge className="h-4 w-4" />}
                      {profile.verified ? <VerifiedBadge className="h-4 w-4" /> : null}
                      {profile.top_streamer ? <TopStreamerBadge className="h-4 w-4" /> : null}
                    </div>
                    {handle ? (
                      <Link
                        href={`/channel/${handle}`}
                        className="truncate text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        @{handle}
                      </Link>
                    ) : (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">—</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{row.current_streak} days</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">best {row.longest_streak}</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-5 py-6 text-sm text-zinc-600 dark:text-zinc-400">
              No streaks yet. Once the Supabase streak migration is applied, streaks will start showing up.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

