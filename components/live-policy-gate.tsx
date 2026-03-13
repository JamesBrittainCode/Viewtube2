'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/spinner';
import {
  LIVE_CREATOR_POLICY,
  LIVE_CREATOR_POLICY_TITLE,
  LIVE_CREATOR_POLICY_VERSION,
  LIVE_VIEWER_POLICY,
  LIVE_VIEWER_POLICY_TITLE,
  LIVE_VIEWER_POLICY_VERSION,
} from '@/lib/policies/live';

type Role = 'viewer' | 'creator';

function getPolicy(role: Role) {
  if (role === 'creator') {
    return {
      title: LIVE_CREATOR_POLICY_TITLE,
      version: LIVE_CREATOR_POLICY_VERSION,
      paragraphs: LIVE_CREATOR_POLICY,
      acceptedAtColumn: 'live_creator_terms_accepted_at',
      versionColumn: 'live_creator_terms_version',
    } as const;
  }
  return {
    title: LIVE_VIEWER_POLICY_TITLE,
    version: LIVE_VIEWER_POLICY_VERSION,
    paragraphs: LIVE_VIEWER_POLICY,
    acceptedAtColumn: 'live_viewer_terms_accepted_at',
    versionColumn: 'live_viewer_terms_version',
  } as const;
}

export function LivePolicyGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const policy = getPolicy(role);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          router.replace('/sign-in');
          return;
        }

        const { data, error: profErr } = await supabase
          .from('profiles')
          .select(
            `id, ${policy.acceptedAtColumn}, ${policy.versionColumn}`,
          )
          .eq('id', user.id)
          .maybeSingle();
        if (profErr) throw profErr;
        const acceptedAt = (data as Record<string, unknown> | null)?.[policy.acceptedAtColumn];
        const ver = (data as Record<string, unknown> | null)?.[policy.versionColumn];
        const isAccepted = Boolean(acceptedAt) && Number(ver) === policy.version;
        if (!cancelled) setAccepted(isAccepted);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Could not load agreement status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [policy.acceptedAtColumn, policy.version, policy.versionColumn, router, supabase]);

  useEffect(() => {
    if (loading || accepted) return;
    // Ensure initial scroll state is evaluated once the modal mounts.
    const t = window.requestAnimationFrame(() => checkScrolled());
    return () => window.cancelAnimationFrame(t);
  }, [accepted, loading]);

  function checkScrolled() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    setScrolledToBottom(atBottom);
  }

  async function onAgree() {
    setError(null);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        router.replace('/sign-in');
        return;
      }

      const payload: Record<string, unknown> = {};
      payload[policy.acceptedAtColumn] = new Date().toISOString();
      payload[policy.versionColumn] = policy.version;

      const { error: upErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (upErr) throw upErr;
      setAccepted(true);
    } catch (e) {
      setError((e as Error).message || 'Could not save agreement.');
    }
  }

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" />
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-sm text-zinc-200 shadow-2xl">
            <Spinner size={20} />
            <span>Checking live agreement…</span>
          </div>
        </div>
      </>
    );
  }
  if (accepted) return <>{children}</>;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">{policy.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              You must scroll to the bottom before you can agree.
            </p>
          </div>

          <div
            ref={scrollRef}
            onScroll={checkScrolled}
            className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4 text-sm text-zinc-200"
          >
            {policy.paragraphs.map((p) => (
              <p key={p} className="leading-6 text-zinc-200">
                {p}
              </p>
            ))}

            <div className="pt-3 text-xs text-zinc-400">
              Version {policy.version}
            </div>
          </div>

          {error ? <div className="px-5 pb-1 text-sm text-red-400">{error}</div> : null}

          <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-5 py-4">
            <button
              type="button"
              onClick={() => router.push('/live')}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onAgree()}
              disabled={!scrolledToBottom}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              I Agree
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
