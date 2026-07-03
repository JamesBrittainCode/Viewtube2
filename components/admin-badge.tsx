import { ShieldCheck } from 'lucide-react';

export function AdminBadge({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-sky-400 text-sky-950 shadow-sm shadow-sky-500/30 ${className}`}
      aria-label="ViewTube Admin"
      title="ViewTube Admin"
    >
      <ShieldCheck className="h-[72%] w-[72%] stroke-[2.7]" />
    </span>
  );
}
