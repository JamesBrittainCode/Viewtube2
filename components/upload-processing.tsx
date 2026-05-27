'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { getUploadState, resetVideoUploadTask, subscribeUploadState } from '@/lib/upload-manager';
import { Spinner } from '@/components/spinner';

function useUploadState() {
  return useSyncExternalStore(subscribeUploadState, getUploadState, getUploadState);
}

export function UploadProcessing() {
  const router = useRouter();
  const state = useUploadState();

  useEffect(() => {
    if (state.stage === 'done' && state.videoId) {
      const timeout = window.setTimeout(() => {
        router.replace(`/watch/${state.videoId}`);
        router.refresh();
      }, state.copyright?.message ? 1800 : 0);
      return () => window.clearTimeout(timeout);
    }
  }, [router, state.stage, state.videoId, state.copyright?.message]);

  const pct = Math.round((state.overall || 0) * 100);

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <Spinner size={22} />
        <div>
          <h1 className="text-xl font-bold">We’re processing your video</h1>
          <p className="mt-1 text-sm text-zinc-500">{state.detail || 'Working…'}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-red-600 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {state.copyright?.message ? (
        <div
          className={[
            'rounded-2xl border p-4 text-sm',
            state.copyright.status === 'matched'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
              : state.copyright.status === 'clean'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
          ].join(' ')}
        >
          {state.copyright.message}
        </div>
      ) : null}

      {state.stage === 'error' && state.error ? (
        <div className="space-y-3">
          <p className="text-sm text-red-500">{state.error}</p>
          <button
            type="button"
            onClick={() => {
              resetVideoUploadTask();
              router.replace('/upload');
            }}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
          >
            Back to upload
          </button>
        </div>
      ) : null}
    </div>
  );
}
