import Link from 'next/link';

export const runtime = 'edge';

export default function StreakContestRulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Contest Rules</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Effective date: May 24, 2026. Contest end date: June 8, 2026 at 11:59:59 PM Pacific Time.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <p className="font-semibold text-zinc-900 dark:text-white">Quick summary (not the Rules):</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            The contest leaderboard is available only to signed-in ViewTube users who confirm they are at least 16 years
            old.
          </li>
          <li>
            You earn points for eligible activity on ViewTube (for example: commenting, liking, subscribing, uploading,
            and going live), and you can maintain a daily streak by being active on consecutive days.
          </li>
          <li>
            The user ranked #1 on the contest leaderboard at the contest end time wins a mystery prize bundle (subject
            to verification and these Rules and Terms).
          </li>
          <li>
            Spammy point activity may cause specific actions to earn no points, but ordinary ViewTube use should remain
            available whenever possible.
          </li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          This summary is for convenience only. The full Rules and Terms & Conditions control in the event of any
          conflict.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">1) Sponsor and Administrator</h2>
          <p>
            This contest (the “Contest”) is sponsored and administered by ViewTube (the “Sponsor”). The Sponsor is
            responsible for the administration of the Contest, including the operation of the Contest leaderboard, the
            awarding of points and streaks, and winner verification.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            These Rules are intended to be “legal-y” and detailed for the ViewTube project. Sponsor may revise these
            Rules as permitted by applicable law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">2) No Purchase Necessary</h2>
          <p>
            No purchase is necessary to participate. A purchase will not increase your chances of winning. Internet
            access and a ViewTube account are required.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">3) Eligibility</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>You must have an active ViewTube account in good standing.</li>
            <li>You must be at least sixteen (16) years of age at the time you participate.</li>
            <li>
              The Contest is void where prohibited or restricted by law. You are responsible for compliance with all
              applicable laws, rules, and regulations.
            </li>
            <li>
              Sponsor may restrict eligibility based on suspected fraud, abuse, policy violations, or to comply with
              applicable law.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">4) Contest Period</h2>
          <p>
            The Contest begins when the Contest is made available within ViewTube and ends on June 8, 2026 at 11:59:59
            PM Pacific Time (the “Contest Period”). Sponsor’s systems are the official timekeeping device.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">5) How to Enter / Participate</h2>
          <p>
            To participate, sign in to your ViewTube account and access the Contest leaderboard (the “Leaderboard”).
            You must confirm that you are at least 16 years old to view the Leaderboard and participate.
          </p>
          <p>
            During the Contest Period, you may earn points and maintain a streak by engaging in eligible activity on
            ViewTube. Participation is limited to natural persons acting on their own behalf. Use of bots, scripts,
            automation, or other methods intended to manipulate points or streaks is prohibited.
          </p>
          <p>
            Eligible activity must be genuine, human, and ordinary in nature. Repeating the same or substantially similar
            action primarily to earn points, including repeated comments, replies, likes, comment likes, subscriptions,
            uploads, live activity, ad reward claims, or other point-earning actions, may be treated as abuse even if the
            action would otherwise be available on ViewTube.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            6) Eligible Activity, Points, and Streaks
          </h2>
          <p>
            Sponsor may award points for certain actions on ViewTube, such as (by way of example only) commenting,
            liking, subscribing, uploading content, or going live. Some actions may award more points than others.
            Sponsor may change point values, eligibility criteria, and the definition of “eligible activity” at any time
            to maintain fairness, reduce abuse, or improve the Contest experience.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Daily streaks</span> are based on consecutive
            days of eligible activity. In general, only your first eligible activity on a given calendar day (Pacific
            Time) may advance your streak for that day. Missing a day may reset your streak.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Going live</span>: points for going live are
            awarded only if you remain live for at least five (5) continuous minutes, as measured by Sponsor’s systems.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Flappy Dunk</span>: points may be awarded at
            a rate of one (1) Contest point per in-game point scored, but only one (1) Flappy Dunk play may earn Contest
            points per Participant per hour. Additional plays may still be available for fun and score tracking but may
            not award additional Contest points until the hourly cooldown resets.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Point action limits</span>: Sponsor’s systems
            may limit, pause, or deny points for unusually rapid, repetitive, coordinated, or otherwise suspicious
            activity across any action that can earn points, including comments, replies, likes, comment likes,
            subscriptions, uploads, live streams, referral activity, ad reward claims, and any future point action.
            These limits are intended to preserve ordinary use of ViewTube while reducing point manipulation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">7) Prohibited Conduct and Anti-Abuse</h2>
          <p>
            The following (non-exhaustive) conduct is prohibited and may result in disqualification, point removal,
            streak resets, suspension, or other enforcement actions:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Creating or using bots, scripts, macros, or automation to generate actions.</li>
            <li>Engaging in spam, harassment, hate, threats, or other policy-violating activity.</li>
            <li>
              Manipulating engagement (including coordinated like/unlike loops, fake accounts, purchased engagement, or
              engagement rings).
            </li>
            <li>Attempting to exploit bugs, glitches, or loopholes in points or streak logic.</li>
            <li>Impersonation or misrepresentation in connection with the Contest.</li>
          </ul>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Comment and reply spam</span> includes, without
            limitation, posting many comments or replies in a short period, posting the same or substantially similar
            comment repeatedly, using comments or replies mainly as a points mechanism, or otherwise disrupting normal
            conversation. If detected, ViewTube may temporarily suspend commenting and may separately pause Contest
            points.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Contest point limits</span>: if Sponsor’s
            systems or moderators detect spammy point activity, specific actions may temporarily earn no Contest points.
            During a point limit, the Participant may continue ordinary ViewTube activity where allowed, but point
            earning may be blocked or reduced for the affected action.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Manual review</span>: ViewTube no longer uses
            automatic three-strike Contest removal. Sponsor may still manually review severe abuse, correct points,
            remove abusive content, or take platform moderation action where necessary.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sponsor’s determination of abuse or manipulation is final and may be made in Sponsor’s sole discretion, to
            the extent permitted by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">8) Winner Determination</h2>
          <p>
            The potential winner is the user ranked #1 on the Leaderboard at the end of the Contest Period. If there is
            a tie or a technical anomaly, Sponsor may apply tie-breakers (including streak length, last active timestamp,
            or other objective signals) or may use another reasonable method of tie resolution.
          </p>
          <p>
            Sponsor may require the potential winner to complete verification steps, including confirming eligibility,
            identity, and compliance with these Rules and the Terms & Conditions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">9) Prize</h2>
          <p>
            The prize is a “mystery prize bundle” selected by Sponsor (the “Prize”). The Prize is non-transferable and
            no cash substitute will be provided, except in Sponsor’s discretion where permitted by law. Sponsor reserves
            the right to substitute a prize of equal or greater value if the Prize becomes unavailable.
          </p>
          <p>
            Winner is responsible for all applicable taxes, fees, and costs associated with the Prize not expressly
            stated as included.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">10) Publicity</h2>
          <p>
            By accepting the Prize (where permitted by law), winner may be required to consent to Sponsor’s use of
            winner’s username, handle, likeness, and/or publicly available profile information for promotional purposes
            without additional compensation, except where prohibited.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">11) Disclaimers</h2>
          <p>
            Sponsor is not responsible for late, lost, invalid, corrupted, misdirected, or incomplete participation; for
            technical failures of any kind; or for any errors in the operation of the Contest, including Leaderboard
            display, point/streak calculation, or system downtime. Sponsor may suspend, modify, or terminate the Contest
            if fairness or integrity is compromised.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">12) Additional Terms</h2>
          <p>
            Participation is also governed by the Contest Terms & Conditions. If there is any conflict between these
            Rules and the Terms & Conditions, the Terms & Conditions control to the extent permitted by law.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/streaks"
          className="rounded-full bg-zinc-900 px-4 py-2 font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          Back to leaderboard
        </Link>
        <Link href="/streaks/terms" className="font-semibold text-zinc-900 underline dark:text-white">
          Contest terms & conditions
        </Link>
      </div>
    </div>
  );
}
