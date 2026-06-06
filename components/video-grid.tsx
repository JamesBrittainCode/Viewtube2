import { VideoCard } from '@/components/video-card';

export function VideoGrid({
  videos,
  signedIn = false,
}: {
  videos: Array<Record<string, unknown>>;
  signedIn?: boolean;
}) {
  if (!videos.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        No videos found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id as string} video={video as never} signedIn={signedIn} />
      ))}
    </div>
  );
}
