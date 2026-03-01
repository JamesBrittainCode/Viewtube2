export function VideoCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-video w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 flex gap-3">
        <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-6/12 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 py-3">
      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/12 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-10/12 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
