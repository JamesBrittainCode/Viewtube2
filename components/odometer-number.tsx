'use client';

import { cn } from '@/lib/utils';

function Digit({ value }: { value: number }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(9, Math.floor(value))) : 0;
  return (
    <span className="relative inline-block h-[1em] w-[0.68em] overflow-hidden align-[-0.08em]">
      <span
        className="block will-change-transform transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(-${v}em)` }}
        aria-hidden="true"
      >
        {Array.from({ length: 10 }).map((_, idx) => (
          <span key={idx} className="block h-[1em] leading-[1em]">
            {idx}
          </span>
        ))}
      </span>
      <span className="sr-only">{v}</span>
    </span>
  );
}

export function OdometerNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const str = Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();

  return (
    <span className={cn('tabular-nums', className)} aria-label={str}>
      {Array.from(str).map((ch, idx) => {
        if (ch >= '0' && ch <= '9') {
          return <Digit key={idx} value={Number(ch)} />;
        }
        return (
          <span key={idx} className="inline-block w-[0.36em] text-center">
            {ch}
          </span>
        );
      })}
    </span>
  );
}

