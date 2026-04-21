import Image from 'next/image';

export function TopStreamerBadge({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      aria-label="Top ViewTube Streamer"
      title="Top ViewTube Streamer"
    >
      <Image
        src="/badges/top-streamer.png"
        alt="Top ViewTube Streamer"
        fill
        className="object-contain"
        sizes="16px"
        priority={false}
      />
    </span>
  );
}

