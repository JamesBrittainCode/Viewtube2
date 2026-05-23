import Link from 'next/link';

export const runtime = 'edge';

export default function StreakContestRulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Contest Rules</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        By participating in the ViewTube Streak contest you agree to these rules and the contest terms.
      </p>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be at least 16 years old to participate.</li>
          <li>You must have a ViewTube account to participate.</li>
          <li>The leaderboard is only available when you’re signed in.</li>
          <li>
            Your points and streak can increase when you interact on ViewTube (comment, like, subscribe, upload a video,
            go live, etc.). Some actions award more points than others.
          </li>
          <li>
            Going live awards points only if you remain live for at least 5 minutes.
          </li>
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/streaks" className="rounded-full bg-zinc-900 px-4 py-2 font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
          Back to leaderboard
        </Link>
        <Link href="/streaks/terms" className="font-semibold text-zinc-900 underline dark:text-white">
          Contest terms & conditions
        </Link>
      </div>
    </div>
  );
}

