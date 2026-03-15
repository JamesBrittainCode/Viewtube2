export default function PrivacyPolicyPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@viewtube.tv';
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: March 3, 2026</p>
      </header>

      <section className="space-y-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <p>
          This Privacy Policy describes how ViewTube collects, uses, stores, and shares information
          when you use the ViewTube website, creator tools, and related services.
        </p>
        <p>
          ViewTube is an independent platform and is not affiliated with, endorsed by, sponsored by,
          or officially connected to Google LLC or YouTube. Any references to third-party platforms
          are for descriptive purposes only.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">1. Information We Collect</h2>
        <p>
          We collect information you provide directly, including account credentials, email address,
          username, channel handle, profile details, uploaded videos, thumbnails, comments, and
          support messages.
        </p>
        <p>
          We also collect platform activity data, such as views, likes, subscriptions, moderation
          outcomes, notifications, and interaction timestamps. Technical information such as IP
          address, browser details, and device metadata may be logged for security, abuse prevention,
          and reliability operations.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">2. How We Use Information</h2>
        <p>
          We use collected data to provide and maintain the service, authenticate users, host and
          deliver content, personalize feeds, detect spam or policy violations, and enforce account
          safety controls including suspension workflows.
        </p>
        <p>
          We may also use information for product improvements, analytics, debugging, legal
          compliance, and internal business operations.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">3. Public vs Private Information</h2>
        <p>
          Public channel information and published videos may be visible to other users and
          visitors. Private account data such as authentication details and non-public contact
          information are treated as restricted and are not intentionally exposed publicly.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">4. Sharing and Processors</h2>
        <p>
          We use third-party infrastructure vendors to operate ViewTube (for example hosting,
          authentication, storage, and email services). These providers process data on our behalf
          under contractual or operational controls required to run the platform.
        </p>
        <p>
          We do not sell personal information for direct monetary compensation.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">5. Content Moderation and Safety</h2>
        <p>
          ViewTube uses automated and manual moderation measures. Content that appears to violate
          policy may be removed, and accounts may receive strikes or suspension actions. Moderation
          records may be retained for trust and safety enforcement and legal requirements.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">6. Data Retention</h2>
        <p>
          We retain data for as long as reasonably necessary to provide services, enforce platform
          rules, resolve disputes, comply with legal obligations, and protect platform integrity.
          Retention periods may vary by data type and legal context.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">7. Security</h2>
        <p>
          We apply reasonable administrative, technical, and organizational safeguards designed to
          protect data. No security method is perfect, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">8. Your Rights and Choices</h2>
        <p>
          Depending on your location, you may have rights to access, correct, or delete certain
          personal information, or to request restrictions on processing. You may also manage some
          account information directly through your profile settings.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">9. Children</h2>
        <p>
          ViewTube is not intended for children under the age required by applicable law in your
          jurisdiction. If we learn that prohibited child data has been collected, we may remove it
          and take account action.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">10. Policy Updates</h2>
        <p>
          We may update this policy to reflect legal, technical, or product changes. Continued use
          of ViewTube after updates may constitute acceptance of the revised policy.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">11. Contact</h2>
        <p>
          For privacy requests or questions, contact {supportEmail}.
        </p>
      </section>
    </main>
  );
}
