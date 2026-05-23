export function StreakFireBadge({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="ViewTube streak champion"
      title="ViewTube streak champion"
    >
      <span className="text-[0.95em] leading-none">🔥</span>
    </span>
  );
}

