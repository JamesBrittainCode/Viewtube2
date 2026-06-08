import Link from 'next/link';

export const runtime = 'edge';

export default function StreakContestTermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Contest Terms & Conditions</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Effective date: May 24, 2026. Contest end date: June 8, 2026 at 11:59:59 AM PST.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <p className="font-semibold text-zinc-900 dark:text-white">Important notice:</p>
        <p className="mt-2">
          These Contest Terms & Conditions (these “Terms”) govern your participation in the ViewTube streak/points
          contest (the “Contest”). By accessing the Contest leaderboard, confirming eligibility, earning points, or
          otherwise participating, you agree to be bound by these Terms and the Contest Rules.
        </p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          This is a “legal-y” draft written for the ViewTube project. It is not legal advice and may be updated by
          Sponsor as permitted by applicable law.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">1) Definitions</h2>
          <p>
            For purposes of these Terms, the following definitions apply:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Sponsor”</span> means ViewTube and its
              owners, affiliates, contractors, and agents involved in operating or administering the Contest.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Participant”</span> means any eligible user
              who participates in the Contest in any manner, including by viewing the Leaderboard after confirming
              eligibility, earning points, or maintaining a streak.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Contest Period”</span> means the time window
              during which points and streaks are tracked for the Contest, ending June 8, 2026 at 11:59:59 AM PST
              Time.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Leaderboard”</span> means the in-app page at
              <span className="font-mono"> /streaks</span> (and any successor page) displaying Participant rankings.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Points”</span> means the numeric value
              awarded by Sponsor for eligible actions on ViewTube, subject to these Terms and Sponsor’s enforcement
              discretion.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Streak”</span> means consecutive calendar
              days (Pacific Time) of eligible activity as recorded by Sponsor’s systems.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Prize”</span> means the mystery prize bundle
              described in the Contest Rules, subject to substitution.
            </li>
            <li>
              <span className="font-semibold text-zinc-900 dark:text-white">“Contest Points Pause”</span> means a
              temporary restriction during which a Participant may be blocked from earning Contest points, even if the
              Participant can still use other ViewTube features.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">2) Incorporation of Rules; Order of Priority</h2>
          <p>
            The Contest Rules are incorporated by reference and form part of these Terms. In the event of a conflict
            between the Rules and these Terms, these Terms control to the extent permitted by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">3) Eligibility and Verification</h2>
          <p>
            Participation is limited to individuals who (a) have a valid ViewTube account in good standing and (b) are at
            least 16 years of age. Sponsor may require eligibility verification at any time, including at the time of
            prize award. Failure to comply with verification requirements may result in disqualification.
          </p>
          <p>
            By confirming that you are 16+, you represent and warrant that your confirmation is truthful. Sponsor may
            request additional proof of eligibility (including age and identity) as a condition of awarding the Prize.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">4) Participation Requirements; Account Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activity that
            occurs under your account. Sponsor is not responsible for unauthorized access, account compromise, or loss of
            points or streaks resulting from account sharing or negligence.
          </p>
          <p>
            Sponsor may disqualify Participants who transfer, sell, share, or purchase accounts, or who participate via
            multiple accounts to manipulate standings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">5) Points and Streak Mechanics; Modifications</h2>
          <p>
            Points and streaks are determined by Sponsor’s systems and may depend on event logging, abuse prevention,
            latency, and other technical factors. Sponsor may, in its discretion, modify how points and streaks are
            calculated or displayed, including adjusting point values for actions, adding or removing eligible actions,
            changing tie-breakers, and updating anti-abuse protections.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Going live minimum</span>: points for going live
            are awarded only when a live session remains active for at least five (5) continuous minutes, as determined
            by Sponsor’s systems. Interrupted streams, restarts, or technical issues may affect eligibility.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Flappy Dunk points</span>: Sponsor may award
            one (1) Contest point for each in-game point scored in Flappy Dunk, subject to a limit of one (1)
            points-eligible Flappy Dunk play per Participant per hour. Sponsor may reduce, deny, reverse, or audit
            Flappy Dunk points if score reporting is unavailable, delayed, manipulated, technically inaccurate, or
            otherwise inconsistent with Contest integrity.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">No “guaranteed points”</span>: any displayed
            points or streak values are estimates until final. Sponsor may correct errors, remove abusive points, or
            reconcile discrepancies at any time, including after the Contest Period, to maintain integrity.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Abuse prevention limits</span>: Sponsor may
            apply automatic or manual limits to any point-earning action, including commenting, replying, liking videos,
            liking comments, subscribing, uploading videos, going live, referral activity, ad reward claims, and any
            future point action. These limits may consider activity speed, repetition, target patterns, text similarity,
            duplicate actions, coordinated behavior, prior enforcement history, and other signals reasonably related to
            Contest integrity.
          </p>
          <p>
            If a point action is denied, reduced, or blocked by anti-abuse systems, the action may still appear on
            ViewTube where technically and legally permitted, but it may not count toward Points, Streaks, Leaderboard
            placement, or Prize eligibility.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">6) Fair Play; Prohibited Conduct</h2>
          <p>
            Participation must be conducted in a fair and lawful manner. In addition to the prohibited conduct described
            in the Contest Rules, you agree not to:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use any automated or non-human means to generate engagement or simulate activity.</li>
            <li>Exploit any bug, vulnerability, or unintended behavior to obtain points or streak advancement.</li>
            <li>Attempt to interfere with the Leaderboard or Contest systems (including by denial-of-service or scraping).</li>
            <li>Engage in fraud, deception, or misrepresentation in connection with the Contest.</li>
            <li>Violate any ViewTube policies, community guidelines, or applicable law.</li>
          </ul>
          <p>
            Sponsor may investigate and take enforcement action in its discretion. Enforcement actions may include
            removing points, resetting streaks, restricting Contest access, suspending or terminating accounts, and
            disqualifying Participants.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Comment, reply, and engagement spam</span> may
            include posting the same or substantially similar comment or reply repeatedly, posting many comments or
            replies in a short period, liking many videos or comments in a pattern that appears primarily designed to
            earn points, repeatedly toggling actions, using multiple accounts, or otherwise using ordinary ViewTube
            features in a way that Sponsor reasonably determines is meant to manipulate Points or Streaks.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">Contest Points Pause</span>: Sponsor may place
            a Participant or a specific action on a temporary Contest Points Pause after suspected spammy point activity.
            During a pause, the Participant may be able to continue ordinary ViewTube activity, but may not earn Contest
            points from the affected point-earning actions.
          </p>
          <p>
            <span className="font-semibold text-zinc-900 dark:text-white">No automatic strike removal</span>: Sponsor’s
            automated anti-abuse systems are intended to deny or pause points for suspicious activity, not automatically
            remove Participants from the Contest. Sponsor may still manually review severe or repeated abuse and may
            remove or adjust points, remove content, restrict features, suspend accounts, or disqualify a potential
            winner if necessary to preserve fairness and comply with platform rules.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">7) Winner Selection; Ties; Disqualification</h2>
          <p>
            The potential winner is the Participant ranked #1 on the Leaderboard at the end of the Contest Period,
            subject to verification and Sponsor’s anti-abuse review. Sponsor may resolve ties using objective criteria,
            including points totals, current streak, longest streak, last active timestamps, or other signals recorded by
            Sponsor. Sponsor’s decisions are final to the extent permitted by law.
          </p>
          <p>
            Sponsor may disqualify any potential winner who fails verification, violates these Terms or the Contest Rules,
            or is reasonably suspected of abuse. In such case, Sponsor may select an alternate winner using the next
            highest-ranked eligible Participant or another reasonable method.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">8) Prize Conditions; Taxes</h2>
          <p>
            The Prize is non-transferable and no substitution is permitted except at Sponsor’s discretion, where allowed
            by law. The Prize may be substituted for an item or bundle of equal or greater value if necessary.
          </p>
          <p>
            Winner is solely responsible for any and all taxes, reporting, customs duties, and other fees associated with
            receipt or use of the Prize. Sponsor may require completion of tax forms or other documentation as a condition
            of prize delivery.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">9) Publicity; Username and Likeness</h2>
          <p>
            Except where prohibited, by accepting the Prize you grant Sponsor the right to use your username, handle,
            and publicly available profile information for promotional purposes in connection with the Contest without
            additional compensation. Sponsor will not use private account information except as permitted by Sponsor’s
            privacy practices and applicable law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">10) Intellectual Property; Participant Content</h2>
          <p>
            Your content remains subject to ViewTube’s platform terms and policies. Sponsor does not claim ownership of
            Participant content solely by virtue of the Contest. However, to the extent you grant licenses under ViewTube
            platform terms (for example, to host, display, and distribute content), those licenses remain in effect.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">11) Disclaimers; Limitation of Liability</h2>
          <p>
            The Contest, Leaderboard, and Prize are provided “AS IS” and “AS AVAILABLE.” Sponsor disclaims all warranties,
            express or implied, including warranties of merchantability, fitness for a particular purpose, and
            non-infringement, to the extent permitted by law.
          </p>
          <p>
            To the fullest extent permitted by law, Sponsor will not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or for any loss of profits, revenues, data, goodwill, or other intangible
            losses arising out of or related to the Contest, even if Sponsor has been advised of the possibility of such
            damages.
          </p>
          <p>
            Sponsor’s total liability for any claim arising out of or relating to the Contest shall not exceed USD $10.00,
            unless a greater limit is required by applicable law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">12) Indemnification</h2>
          <p>
            To the fullest extent permitted by law, you agree to indemnify, defend, and hold harmless Sponsor from and
            against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising
            from your participation, your violation of these Terms, or your violation of any rights of another person or
            entity.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">13) Privacy</h2>
          <p>
            Sponsor may process information related to your participation, including your username, account ID, points,
            streak status, and activity timestamps, for the purpose of administering the Contest, preventing abuse, and
            awarding the Prize. Sponsor’s general privacy practices are described in ViewTube’s Privacy Policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">14) Disputes; Governing Law</h2>
          <p>
            Except where prohibited by law, you agree that any dispute arising out of or related to the Contest will be
            resolved in a court of competent jurisdiction, and you consent to personal jurisdiction and venue in such
            court. Governing law will be determined by Sponsor’s principal place of business, without regard to conflict
            of laws principles.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">15) General Conditions</h2>
          <p>
            Sponsor reserves the right to cancel, suspend, or modify the Contest if fraud, technical failures, or any
            other factor beyond Sponsor’s reasonable control impairs the integrity or proper functioning of the Contest.
            Sponsor may disqualify any individual who tampers with the entry process or the operation of the Contest.
          </p>
          <p>
            If any provision of these Terms is held invalid or unenforceable, the remaining provisions will remain in
            full force and effect.
          </p>
          <p>
            These Terms constitute the entire agreement between you and Sponsor regarding the Contest and supersede any
            prior or contemporaneous communications relating to the Contest.
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
        <Link href="/streaks/rules" className="font-semibold text-zinc-900 underline dark:text-white">
          Contest rules
        </Link>
      </div>
    </div>
  );
}
