import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StreakFireBadge } from '@/components/streak-fire-badge';
import { VerifiedBadge } from '@/components/verified-badge';
import { TopStreamerBadge } from '@/components/top-streamer-badge';
import { StreakEligibilityGate } from '@/components/streak-eligibility-gate';

export const runtime = 'edge';

type Row = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  last_active_date: string | null;
  profiles?: {
    username?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
    verified?: boolean | null;
    top_streamer?: boolean | null;
    streak_champion?: boolean | null;
  } | null;
};

export default async function StreaksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in?redirect=/streaks');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('age_confirmed_16,handle')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.age_confirmed_16) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <StreakEligibilityGate />
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Prizes</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Whoever is <span className="font-semibold">#1 on the leaderboard</span> by{' '}
            <span className="font-semibold">July 1, 2026</span> wins a mystery prize bundle.
          </p>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/streaks/rules" className="underline">
              Rules
            </Link>{' '}
            •{' '}
            <Link href="/streaks/terms" className="underline">
              Terms & conditions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [{ data: myStreak }, { data: leaderboard }] = await Promise.all([
    supabase
      .from('viewtube_streaks')
      .select('user_id,current_streak,longest_streak,points,last_active_date')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('viewtube_streaks')
      .select(
        'user_id,current_streak,longest_streak,points,last_active_date,profiles:profiles!viewtube_streaks_user_id_fkey(username,handle,avatar_url,verified,top_streamer,streak_champion)',
      )
      .order('points', { ascending: false })
      .order('current_streak', { ascending: false })
      .order('longest_streak', { ascending: false })
      .order('last_active_date', { ascending: false })
      .limit(50),
  ]);

  const rows = (leaderboard || []) as Row[];
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || '';
  const referralLink =
    profile?.handle ? `${siteOrigin || ''}/ref/${encodeURIComponent(profile.handle)}` : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">ViewTube Streak</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Keep a streak by logging in and doing at least one interaction per day (comment, like, subscribe, upload, go
          live).
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/streaks/rules" className="underline">
            Rules
          </Link>
          <span>•</span>
          <Link href="/streaks/terms" className="underline">
            Terms & conditions
          </Link>
        </div>

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
          <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Points</div>
            <div className="text-lg font-bold text-zinc-900 dark:text-white">{myStreak?.points ?? 0}</div>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Last active:{' '}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {myStreak?.last_active_date ?? '—'}
            </span>
          </div>
        </div>

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
              const isChampion = Boolean(profile.streak_champion) || index === 0;
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
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{row.points} pts</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {row.current_streak} day streak • best {row.longest_streak}
                    </div>
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Prizes</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
          <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-2xl bg-zinc-100 p-2 dark:bg-zinc-800 sm:mx-0">
            <Image
              src="/streak-mystery-box.png"
              alt="Mystery prize bundle"
              fill
              className="object-contain"
              sizes="128px"
            />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Whoever is <span className="font-semibold">#1 on the leaderboard</span> by{' '}
            <span className="font-semibold">July 1, 2026</span> wins a mystery prize bundle.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Points tiers</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Points are awarded for eligible actions. Values may change to prevent abuse and keep the contest fair.
        </p>
        {referralLink ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Your referral link</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-white px-3 py-2 text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {referralLink}
              </code>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Share this to earn +50 when they join.</span>
            </div>
          </div>
        ) : null}
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Points</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Invite a friend</td>
                <td className="px-4 py-3 font-semibold">+50</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  Earned when they create an account using your referral link.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Watch an ad</td>
                <td className="px-4 py-3 font-semibold">+30</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  <Link href="/streaks/ad" className="font-semibold underline">
                    Watch an ad
                  </Link>{' '}
                  (one claim per day UTC; 60 seconds).
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Upload a video</td>
                <td className="px-4 py-3 font-semibold">+25</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Eligible uploads only.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Go live</td>
                <td className="px-4 py-3 font-semibold">+20</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Must be live for at least 5 minutes.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Comment</td>
                <td className="px-4 py-3 font-semibold">+8</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Spam and abuse may be removed.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Subscribe</td>
                <td className="px-4 py-3 font-semibold">+6</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Points awarded once per creator.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Like a video</td>
                <td className="px-4 py-3 font-semibold">+2</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Points awarded once per video.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">Like a comment</td>
                <td className="px-4 py-3 font-semibold">+2</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Points awarded once per comment.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
