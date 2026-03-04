import Link from 'next/link';

export default function EmailConfirmedPage() {
  return (
    <section className="mx-auto mt-16 max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-3xl font-bold">Email Confirmed</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Your email is verified. You can now use all ViewTube features.
      </p>
      <Link
        href="/sign-in"
        className="mt-6 inline-flex rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
      >
        Continue to Sign in
      </Link>
    </section>
  );
}
