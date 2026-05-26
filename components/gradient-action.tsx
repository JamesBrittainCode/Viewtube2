'use client';

import Link from 'next/link';

function Base({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <span
        className={[
          'absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          'bg-[length:200%_200%] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400',
          'animate-[vtGradient_3.5s_ease_infinite]',
        ].join(' ')}
      />
      <span className="absolute inset-0 bg-black/35" />
      <span className={['relative z-10', className].join(' ')}>{children}</span>
      <style jsx>{`
        @keyframes vtGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </>
  );
}

export function GradientActionLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full px-3 py-1.5 text-[11px] font-semibold text-white',
        'bg-zinc-950 dark:bg-zinc-900',
        'ring-1 ring-white/10 hover:ring-white/20',
        'transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_30px_rgba(244,63,94,0.20)] active:scale-[0.98]',
        className,
      ].join(' ')}
    >
      <Base>{children}</Base>
    </Link>
  );
}

export function GradientActionButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full px-3 py-1.5 text-[11px] font-semibold text-white',
        'bg-zinc-950 dark:bg-zinc-900',
        'ring-1 ring-white/10 hover:ring-white/20',
        'transition-[transform,box-shadow] duration-200 hover:shadow-[0_10px_30px_rgba(244,63,94,0.20)] active:scale-[0.98]',
        className,
      ].join(' ')}
    >
      <Base>{children}</Base>
    </button>
  );
}

