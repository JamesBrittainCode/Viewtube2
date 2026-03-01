import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto mt-20 max-w-lg text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-zinc-500">The page you requested could not be found.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-zinc-900 px-4 py-2 text-white dark:bg-white dark:text-zinc-900">
        Back to home
      </Link>
    </div>
  );
}
