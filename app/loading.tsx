import { Spinner } from '@/components/spinner';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner size={34} />
      <p className="text-sm text-zinc-500">Loading...</p>
    </div>
  );
}
