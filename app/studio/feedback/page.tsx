'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type FeedbackItem = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  profile?: {
    username?: string | null;
    handle?: string | null;
  } | null;
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

export default function StudioFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/studio/feedback', { cache: 'no-store' });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = (await res.json()) as { feedback?: FeedbackItem[]; is_admin?: boolean };
        setFeedback(data.feedback || []);
        setIsAdmin(Boolean(data.is_admin));
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
      const res = await fetch('/api/studio/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as { feedback?: FeedbackItem };
      if (data.feedback) {
        setFeedback((prev) => [data.feedback!, ...prev]);
      }
      setSubject('');
      setMessage('');
      setOk('Feedback submitted.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const heading = useMemo(
    () => (isAdmin ? 'Feedback (All Submissions)' : 'Feedback'),
    [isAdmin],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <h1 className="text-3xl font-bold">{heading}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Share what you want added to ViewTube Studio.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={120}
            placeholder="Subject (optional)"
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="What should we improve?"
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
            {saving ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">{isAdmin ? 'All feedback submissions' : 'Your submissions'}</h2>
        {loading ? <p className="mt-3 text-sm text-zinc-400">Loading feedback...</p> : null}
        {!loading && !feedback.length ? (
          <p className="mt-3 text-sm text-zinc-400">No feedback submissions yet.</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {feedback.map((item) => (
            <article key={item.id} className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.subject || 'Feedback'}</p>
                  {isAdmin ? (
                    <p className="text-xs text-zinc-500">
                      {(item.profile?.username || 'User')} {item.profile?.handle ? `(${item.profile.handle})` : ''}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{item.message}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">Status: {item.status}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

