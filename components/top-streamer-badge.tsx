import { Check } from 'lucide-react';

export function TopStreamerBadge({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-red-500 text-zinc-950 dark:bg-red-500 dark:text-zinc-950 ${className}`}
      aria-label="Top ViewTube Streamer"
      title="Top ViewTube Streamer"
    >
      <Check className="h-[70%] w-[70%] stroke-[3]" />
    </span>
  );
}
