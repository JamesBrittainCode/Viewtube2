'use client';

import { useState } from 'react';

type Submission = {
  id: string;
  ad_title: string;
  company_name: string;
  status: string;
  calculated_price_usd?: number | null;
  payment_amount_usd?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  paypal_transaction_id?: string | null;
  created_at: string;
};

export function AdvertiserPortal({ submissions }: { submissions: Submission[] }) {
  const paypalCheckoutUrl = process.env.NEXT_PUBLIC_PAYPAL_CHECKOUT_URL || '';
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txById, setTxById] = useState<Record<string, string>>({});

  async function submitPayment(submissionId: string, amount: number) {
    const tx = (txById[submissionId] || '').trim();
    if (!tx) {
      setError('Transaction ID is required.');
      return;
    }

    setSavingId(submissionId);
    setError(null);
    try {
      const res = await fetch(`/api/advertise/submissions/${submissionId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypal_transaction_id: tx,
          payment_amount_usd: amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment submission failed');
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-4">
      {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
      {!submissions.length ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          No advertising submissions yet.
        </p>
      ) : null}
      {submissions.map((item) => (
        <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{item.ad_title}</h3>
              <p className="text-sm text-zinc-500">{item.company_name}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Submitted {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-700">
              {item.status.replaceAll('_', ' ')}
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs text-zinc-500">Required budget</p>
              <p className="text-base font-semibold">${Number(item.calculated_price_usd || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs text-zinc-500">Start</p>
              <p className="text-sm">{item.starts_at ? new Date(item.starts_at).toLocaleString() : 'Not set'}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs text-zinc-500">End</p>
              <p className="text-sm">{item.ends_at ? new Date(item.ends_at).toLocaleString() : 'Not set'}</p>
            </div>
          </div>

          {item.status === 'approved_pending_payment' ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Approved. Payment required before launch.</p>
              {paypalCheckoutUrl ? (
                <a
                  href={paypalCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Pay with PayPal
                </a>
              ) : (
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  PayPal checkout URL is not configured yet.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={txById[item.id] || ''}
                  onChange={(event) => setTxById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  placeholder="PayPal transaction ID"
                  className="h-10 min-w-[240px] rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => void submitPayment(item.id, Number(item.calculated_price_usd || 0))}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {savingId === item.id ? 'Submitting...' : 'Submit Payment'}
                </button>
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
