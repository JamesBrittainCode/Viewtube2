import { BadgeCheck } from 'lucide-react';

export function VerifiedBadge({ className = 'h-4 w-4 text-blue-500' }: { className?: string }) {
  return <BadgeCheck className={className} aria-label="Verified channel" />;
}
