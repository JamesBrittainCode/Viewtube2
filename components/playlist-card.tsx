import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export type PlaylistCardData = {
  id: string;
  title: string;
  is_public: boolean;
  updated_at: string;
  videoCount: number;
  coverThumbnailUrl: string | null;
};

export function PlaylistCard({ playlist }: { playlist: PlaylistCardData }) {
  const updated = playlist.updated_at ? formatDistanceToNow(new Date(playlist.updated_at), { addSuffix: true }) : '';
  return (
    <article className="group">
      <Link href={`/playlists/${playlist.id}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800">
          {playlist.coverThumbnailUrl ? (
            <Image
              src={playlist.coverThumbnailUrl}
              alt={playlist.title}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950" />
          )}
          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-2 py-1 text-xs font-semibold text-white">
            {playlist.videoCount.toLocaleString()} {playlist.videoCount === 1 ? 'video' : 'videos'}
          </span>
        </div>
      </Link>

      <div className="mt-3 space-y-1">
        <Link href={`/playlists/${playlist.id}`} className="line-clamp-2 text-base font-semibold group-hover:underline">
          {playlist.title}
        </Link>
        <p className="text-sm text-zinc-500">
          {playlist.is_public ? 'Public' : 'Private'} • Playlist
        </p>
        {updated ? <p className="text-sm text-zinc-500">Updated {updated}</p> : null}
        <Link href={`/playlists/${playlist.id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          View full playlist
        </Link>
      </div>
    </article>
  );
}

