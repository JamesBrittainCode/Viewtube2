'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';

type Props = {
  videoId: string;
  initialRemoved?: boolean;
};

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Request failed';
  } catch {
    return text || 'Request failed';
  }
}

export function AdminVideoTakedownButton({ videoId, initialRemoved = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [removed, setRemoved] = useState(initialRemoved);

  async function onTakeDown() {
    if (removed || loading) return;
    const reason = window.prompt('Why are you taking this video down?');
    const finalReason = (reason || '').trim();
    if (!finalReason) return;

    setLoading(true);
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: videoId,
          action: 'takedown',
          reason: finalReason,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setRemoved(true);
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message || 'Could not take down video.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onTakeDown()}
      disabled={loading || removed}
      title={removed ? 'Video is already removed' : 'Take down video'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900/50"
      aria-label={removed ? 'Video removed' : 'Take down video'}
    >
      <Ban className="h-5 w-5" />
    </button>
  );
}
