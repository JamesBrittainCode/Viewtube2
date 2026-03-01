import { CommentSkeleton, VideoCardSkeleton } from '@/components/skeletons';

export default function WatchLoading() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <div className="aspect-video w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 h-6 w-8/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <CommentSkeleton key={idx} />
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <VideoCardSkeleton key={idx} />
        ))}
      </aside>
    </div>
  );
}
