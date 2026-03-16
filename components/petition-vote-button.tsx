'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PetitionLiveCount } from '@/components/petition-live-count';

type PetitionState = { voted: boolean };

export function PetitionVoteButton({ petitionKey, initialCount }: { petitionKey: string; initialCount: number }) {
  const router = useRouter();
  const [state, setState] = useState<PetitionState>({ voted: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch('/api/petitions/yikes', { cache: 'no-store' });
      const data = (await res.json()) as { count?: number; voted?: boolean };
      if (cancelled) return;
      setState({ voted: Boolean(data.voted) });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleVote() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/petitions/yikes', { method: state.voted ? 'DELETE' : 'POST' });
      const text = await res.text();
      let payload: { error?: string } = {};
      try {
        payload = JSON.parse(text) as typeof payload;
      } catch {
        payload = { error: text || 'Request failed' };
      }
      if (res.status === 401) {
        router.push('/sign-in?redirect=/petition/yikes');
        return;
      }
      if (!res.ok) throw new Error(payload.error || 'Request failed');

      // Refresh voted status from the server.
      const updatedRes = await fetch('/api/petitions/yikes', { cache: 'no-store' });
      const updated = (await updatedRes.json()) as { count?: number; voted?: boolean };
      setState({ voted: Boolean(updated.voted) });
    } catch (e) {
      setError((e as Error).message || 'Could not update petition.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void toggleVote()}
        disabled={loading}
        className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-70"
      >
        {loading ? 'Working…' : state.voted ? 'Signed' : 'Sign petition'}
      </button>
      <p className="text-center text-xs text-white/90">
        <PetitionLiveCount petitionKey={petitionKey} initialCount={initialCount} showSuffix />
      </p>
      {error ? <p className="text-center text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
