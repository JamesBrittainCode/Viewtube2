export function AdminBadge({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.25)] ${className}`}
      aria-label="ViewTube Admin"
      role="img"
    >
      <title>ViewTube Admin</title>
      <path
        fill="currentColor"
        d="M12 2.75 20 6.2v5.95c0 5.05-3.4 8.36-8 9.1-4.6-.74-8-4.05-8-9.1V6.2l8-3.45Z"
      />
    </svg>
  );
}
