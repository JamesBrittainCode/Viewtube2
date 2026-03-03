import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-1.5 font-bold text-lg sm:gap-2 sm:text-xl">
      <span className="rounded-md bg-red-600 px-2 py-1 text-white">View</span>
      <span className="hidden sm:inline">Tube</span>
    </Link>
  );
}
