'use client';

import { FormEvent, useState } from 'react';
import { Flag } from 'lucide-react';
import { VIDEO_REPORT_REASONS } from '@/lib/media-moderation';

type Props = {
  videoId: string;
  variant?: 'button' | 'menu';
};

async function parseApiError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || 'Report failed';
  } catch {
    return text || 'Report failed';
  }
}

export function ReportVideoButton({ videoId, variant = 'button' }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setMessage('Report submitted. Thanks for helping keep ViewTube safe.');
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {variant === 'menu' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-100 hover:bg-white/10"
        >
          <Flag className="h-5 w-5" />
          Report
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Report
        </button>
      )}
      {message ? <p className="text-xs text-zinc-500">{message}</p> : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-lg font-semibold">Report image or title</h3>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div className="space-y-2">
                {VIDEO_REPORT_REASONS.map((item) => (
                  <label key={item} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="reason"
                      checked={reason === item}
                      onChange={() => setReason(item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
              <textarea
                rows={3}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Additional details (optional)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm"
              />
              {error ? <p className="text-xs text-red-400">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!reason || saving}
                  className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                >
                  {saving ? 'Reporting...' : 'Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
