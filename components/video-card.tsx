import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { VerifiedBadge } from '@/components/verified-badge';

type Props = {
  video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    views: number;
    created_at: string;
    profiles?: {
      username?: string;
      avatar_url?: string | null;
      verified?: boolean;
    };
  };
};

export function VideoCard({ video }: Props) {
  const createdAt = formatDistanceToNow(new Date(video.created_at), {
    addSuffix: true,
  });
  const channelHref = video.profiles?.username
    ? `/channel/${video.profiles.username}`
    : '/';

  return (
    <article className="group">
      <Link href={`/watch/${video.id}`}>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
          <Image
            src={video.thumbnail_url || '/thumbnail-placeholder.svg'}
            alt={video.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      </Link>

      <div className="mt-3 flex gap-3">
        <Image
          src={video.profiles?.avatar_url || '/avatar-placeholder.svg'}
          alt={video.profiles?.username || 'Channel'}
          width={36}
          height={36}
          className="h-9 w-9 rounded-full object-cover"
        />

        <div className="min-w-0">
          <Link href={`/watch/${video.id}`} className="line-clamp-2 text-sm font-semibold">
            {video.title}
          </Link>
          <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <Link href={channelHref} className="hover:text-zinc-700 dark:hover:text-zinc-300">
              {video.profiles?.username || 'Unknown channel'}
            </Link>
            {video.profiles?.verified && <VerifiedBadge className="h-3.5 w-3.5 text-blue-500" />}
          </div>
          <p className="text-xs text-zinc-500">
            {video.views.toLocaleString()} views • {createdAt}
          </p>
        </div>
      </div>
    </article>
  );
}
