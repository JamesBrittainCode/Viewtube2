import { VideoCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, idx) => (
        <VideoCardSkeleton key={idx} />
      ))}
    </div>
  );
}
