export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: March 3, 2026</p>
      </header>

      <section className="space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <p>
          By creating an account or using ViewTube, you agree to follow these terms and all
          applicable laws.
        </p>
        <p>
          You are responsible for the content you upload and must not post illegal, harmful,
          abusive, or infringing material. ViewTube may remove content or suspend accounts for
          policy violations.
        </p>
        <p>
          Repeat violations can result in account suspension or permanent removal. Access may be
          restricted to protect users and platform integrity.
        </p>
        <p>
          ViewTube may update product features, moderation systems, and policies over time. Your
          continued use means you accept updated terms.
        </p>
        <p>
          For support or legal questions, contact support@viewtube.heyrivo.com.
        </p>
      </section>
    </main>
  );
}
