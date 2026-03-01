import Link from 'next/link';

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const email = (await searchParams).email || 'your email address';

  return (
    <div className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-bold">Check your email</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
        We sent a verification link to <span className="font-medium">{email}</span>. Verify your email,
        then sign in to continue.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/sign-in"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          Go to sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Use another email
        </Link>
      </div>
    </div>
  );
}
