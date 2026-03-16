import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { unwrapRelation } from '@/lib/profile';
import { VerifiedBadge } from '@/components/verified-badge';
import { formatDuration } from '@/lib/format-duration';

type Props = {
  video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    duration_seconds?: number | null;
    views: number;
    created_at: string;
    profiles?:
      | {
          username?: string;
          handle?: string;
          avatar_url?: string | null;
          verified?: boolean;
        }
      | Array<{
          username?: string;
          handle?: string;
          avatar_url?: string | null;
          verified?: boolean;
        }>;
  };
};

export function VideoCard({ video }: Props) {
  const createdAt = formatDistanceToNow(new Date(video.created_at), {
    addSuffix: true,
  });
  const profile = unwrapRelation(video.profiles);
  const channelHref = profile?.handle ? `/channel/${profile.handle}` : '/';

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
          {video.duration_seconds && video.duration_seconds > 0 && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 flex gap-3">
        <Image
          src={profile?.avatar_url || '/avatar-placeholder.svg'}
          alt={profile?.username || 'Channel'}
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
              {profile?.username || 'Unknown channel'}
            </Link>
            {profile?.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
          </div>
          <p className="text-xs text-zinc-500">
            {video.views.toLocaleString()} views • {createdAt}
          </p>
        </div>
      </div>
    </article>
  );
}
