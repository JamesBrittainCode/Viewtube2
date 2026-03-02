import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
      <span className="rounded-md bg-red-600 px-2 py-1 text-white">View</span>
      <span>Tube</span>
    </Link>
  );
}
