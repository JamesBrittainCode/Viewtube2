import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { unwrapRelation } from '@/lib/profile';
import { StreakFireBadge } from '@/components/streak-fire-badge';
import { VerifiedBadge } from '@/components/verified-badge';
import { AdminBadge } from '@/components/admin-badge';
import { TopStreamerBadge } from '@/components/top-streamer-badge';
import { formatDuration } from '@/lib/format-duration';
import { VideoCardMenu } from '@/components/video-card-menu';

type Props = {
  video: {
    id: string;
    user_id?: string;
    title: string;
    thumbnail_url: string | null;
    video_url?: string | null;
    duration_seconds?: number | null;
    is_short?: boolean | null;
    views: number;
    created_at: string;
    profiles?:
      | {
          id?: string;
          username?: string;
          handle?: string;
          avatar_url?: string | null;
          verified?: boolean;
          is_admin?: boolean;
          top_streamer?: boolean;
          streak_champion?: boolean;
        }
      | Array<{
          id?: string;
          username?: string;
          handle?: string;
          avatar_url?: string | null;
          verified?: boolean;
          is_admin?: boolean;
          top_streamer?: boolean;
          streak_champion?: boolean;
        }>;
  };
};

export function VideoCard({ video, signedIn = false }: Props & { signedIn?: boolean }) {
  const createdAt = formatDistanceToNow(new Date(video.created_at), {
    addSuffix: true,
  });
  const profile = unwrapRelation(video.profiles);
  const channelHref = profile?.handle ? `/channel/${profile.handle}` : '/';
  const isShort = Boolean(video.is_short);
  const videoHref = isShort ? `/shorts/${video.id}` : `/watch/${video.id}`;

  return (
    <article className="group transition duration-200" data-video-card={video.id}>
      <Link href={videoHref}>
        <div
          className={[
            'relative overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800',
            isShort ? 'aspect-[9/16]' : 'aspect-video',
          ].join(' ')}
        >
          <Image
            src={video.thumbnail_url || '/thumbnail-placeholder.svg'}
            alt={video.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {isShort ? (
            <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold leading-none text-white">
              Short
            </span>
          ) : null}
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

        <div className="min-w-0 flex-1">
          <Link href={videoHref} className="line-clamp-2 text-sm font-semibold">
            {video.title}
          </Link>
          <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <Link href={channelHref} className="hover:text-zinc-700 dark:hover:text-zinc-300">
              {profile?.username || 'Unknown channel'}
            </Link>
            {profile?.streak_champion && <StreakFireBadge className="h-3.5 w-3.5" />}
            {profile?.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
            {profile?.is_admin && <AdminBadge className="h-3.5 w-3.5" />}
            {profile?.top_streamer && <TopStreamerBadge className="h-3.5 w-3.5" />}
          </div>
          <p className="text-xs text-zinc-500">
            {video.views.toLocaleString()} views • {createdAt}
          </p>
        </div>
        <VideoCardMenu
          videoId={video.id}
          title={video.title}
          videoUrl={video.video_url}
          channelId={video.user_id || profile?.id || null}
          signedIn={signedIn}
        />
      </div>
    </article>
  );
}
