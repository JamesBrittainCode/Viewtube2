export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: March 3, 2026</p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <p>
          ViewTube collects account information (email, username, handle), profile content,
          uploaded media, and activity data required to provide the service.
        </p>
        <p>
          We use this data to operate the platform, secure accounts, moderate harmful content,
          and improve product reliability.
        </p>
        <p>
          Public profile and video content may be visible to other users. Private account details
          are not sold. We may share data with infrastructure providers strictly to run ViewTube.
        </p>
        <p>
          We retain data as needed for legal, security, and abuse prevention reasons. Suspended
          accounts and moderation records may be retained for enforcement.
        </p>
        <p>
          For privacy requests, contact support@viewtube.heyrivo.com.
        </p>
      </section>
    </main>
  );
}
