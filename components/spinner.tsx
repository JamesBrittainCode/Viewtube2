export function Spinner({
  size = 34,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const px = Math.max(16, Math.min(96, Math.floor(size)));
  return (
    <div
      aria-label="Loading"
      role="status"
      className={`inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white ${className}`}
      style={{ width: px, height: px }}
    />
  );
}

