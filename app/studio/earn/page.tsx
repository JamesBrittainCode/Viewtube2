'use client';

import { FormEvent, useEffect, useState } from 'react';

type EarnApplication = {
  id: string;
  full_name: string;
  email: string;
  channel_focus: string;
  why_join: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

type EarnPayload = {
  profile?: { subscribers_count?: number; username?: string } | null;
  eligible?: boolean;
  application?: EarnApplication | null;
  error?: string;
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

export default function StudioEarnPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [subs, setSubs] = useState(0);
  const [application, setApplication] = useState<EarnApplication | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [focus, setFocus] = useState('');
  const [whyJoin, setWhyJoin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/studio/earn-applications', { cache: 'no-store' });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = (await res.json()) as EarnPayload;
        setEligible(Boolean(data.eligible));
        setSubs(Number(data.profile?.subscribers_count || 0));
        setApplication(data.application || null);
        if (data.application) {
          setFullName(data.application.full_name || '');
          setEmail(data.application.email || '');
          setFocus(data.application.channel_focus || '');
          setWhyJoin(data.application.why_join || '');
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch('/api/studio/earn-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          channel_focus: focus.trim(),
          why_join: whyJoin.trim(),
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { application?: EarnApplication };
      if (data.application) setApplication(data.application);
      setOk('Application submitted.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold">Earn</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Apply to join monetization once your channel reaches 500 subscribers.
        </p>
        <p className="mt-2 text-sm text-zinc-500">Current subscribers: {subs.toLocaleString()}</p>

        {loading ? <p className="mt-4 text-sm text-zinc-400">Loading...</p> : null}
        {!loading && !eligible ? (
          <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
            You need at least 500 subscribers to apply.
          </p>
        ) : null}

        {!loading && eligible ? (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
              required
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Contact email"
              type="email"
              required
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm"
            />
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              placeholder="Channel focus (optional)"
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm"
            />
            <textarea
              value={whyJoin}
              onChange={(event) => setWhyJoin(event.target.value)}
              placeholder="Tell us why you want to join the Earn program"
              rows={5}
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm"
            />
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {ok ? <p className="text-sm text-green-400">{ok}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              {saving ? 'Submitting...' : application ? 'Update Application' : 'Submit Application'}
            </button>
          </form>
        ) : null}
      </section>

      {application ? (
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Application status: {application.status}</h2>
          {application.admin_notes ? (
            <p className="mt-2 text-sm text-zinc-300">Admin notes: {application.admin_notes}</p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            Submitted {new Date(application.created_at).toLocaleString()}
            {application.reviewed_at ? ` • Reviewed ${new Date(application.reviewed_at).toLocaleString()}` : ''}
          </p>
        </section>
      ) : null}
    </div>
  );
}

