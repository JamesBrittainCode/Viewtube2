import Link from 'next/link';

export const runtime = 'edge';

export default function StreakContestTermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Contest Terms & Conditions</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This page describes the rules and conditions for the ViewTube Streak contest.
      </p>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <p>
          Eligibility: You must be at least 16 years old and have an active ViewTube account to participate.
        </p>
        <p>
          Leaderboard access: The contest leaderboard is available only to signed-in users.
        </p>
        <p>
          Prize: Whoever is #1 on the points/streak leaderboard by July 1, 2026 wins a mystery prize bundle.
        </p>
        <p>
          Anti-abuse: ViewTube may remove points, streaks, or disqualify accounts for suspected abuse, spam, or attempts
          to manipulate results.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          These terms are a product placeholder and can be expanded with legal language later.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/streaks" className="rounded-full bg-zinc-900 px-4 py-2 font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
          Back to leaderboard
        </Link>
        <Link href="/streaks/rules" className="font-semibold text-zinc-900 underline dark:text-white">
          Contest rules
        </Link>
      </div>
    </div>
  );
}

