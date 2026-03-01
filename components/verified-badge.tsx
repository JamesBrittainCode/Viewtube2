import { Check } from 'lucide-react';

export function VerifiedBadge({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-zinc-400 text-zinc-950 dark:bg-zinc-500 dark:text-zinc-900 ${className}`}
      aria-label="Verified channel"
      title="Verified channel"
    >
      <Check className="h-[70%] w-[70%] stroke-[3]" />
    </span>
  );
}
