'use client';

import { FormEvent, useMemo, useState } from 'react';

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Request failed';
  } catch {
    return text || 'Request failed';
  }
}

const CATEGORIES = [
  'Account',
  'Payments/Billing',
  'Copyright/Monetization',
  'Report a Bug',
  'Report Abuse',
  'Other',
] as const;

type Category = (typeof CATEGORIES)[number];

export function SupportForm() {
  const [category, setCategory] = useState<Category>('Account');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const computedSubject = useMemo(() => {
    const base = subject.trim();
    const prefix = `Support (${category})`;
    if (!base) return prefix;
    return `${prefix}: ${base}`;
  }, [category, subject]);

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
          subject: computedSubject.slice(0, 120),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setSubject('');
      setMessage('');
      setOk('Message sent. Our admin team will review it in Studio.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-zinc-200">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary (optional)"
            maxLength={100}
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-zinc-200">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what happened and include any important details."
          maxLength={2000}
          rows={6}
          required
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-green-400">{ok}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-60"
        >
          {saving ? 'Sending…' : 'Send message'}
        </button>
        <p className="text-xs text-zinc-500">
          Your message is saved to Studio and visible to admins.
        </p>
      </div>
    </form>
  );
}

