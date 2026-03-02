import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
      <span className="inline-flex h-7 w-11 items-center justify-center rounded-[0.6rem] bg-red-600">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
          <path d="M15 7L8 12L15 17V7Z" />
        </svg>
      </span>
      <span>ViewTube</span>
    </Link>
  );
}
