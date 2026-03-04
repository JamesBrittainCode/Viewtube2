'use client';

type Submission = {
  id: string;
  ad_title: string;
  company_name: string;
  status: string;
  calculated_price_usd?: number | null;
  payment_amount_usd?: number | null;
  payment_provider?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  paypal_transaction_id?: string | null;
  converted_ad_id?: string | null;
  ad_is_active?: boolean;
  ad_impressions_count?: number;
  ad_clicks_count?: number;
  ad_completions_count?: number;
  created_at: string;
};

export function AdvertiserPortal({ submissions }: { submissions: Submission[] }) {
  const fourthwallCheckoutUrl = process.env.NEXT_PUBLIC_FOURTHWALL_CHECKOUT_URL || '';
  const unitPrice = Number(process.env.NEXT_PUBLIC_FOURTHWALL_AD_UNIT_PRICE || '7.50');
  const error: string | null = null;
  const unit = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 7.5;

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

          {item.converted_ad_id ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs text-zinc-500">Ad status</p>
                <p className="text-sm font-semibold">{item.ad_is_active ? 'Running' : 'Ended'}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs text-zinc-500">Impressions</p>
                <p className="text-sm font-semibold">{(item.ad_impressions_count || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs text-zinc-500">Clicks</p>
                <p className="text-sm font-semibold">{(item.ad_clicks_count || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs text-zinc-500">Completions</p>
                <p className="text-sm font-semibold">{(item.ad_completions_count || 0).toLocaleString()}</p>
              </div>
            </div>
          ) : null}

          {item.status === 'approved_pending_payment' ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Approved. Payment required before launch.</p>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                Use the same account email at checkout. In order notes, include: <span className="font-semibold">{item.id}</span>
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                Suggested quantity: {Math.max(1, Math.round(Number(item.calculated_price_usd || 0) / unit))} unit(s) @ ${unit.toFixed(2)} each.
              </p>
              {fourthwallCheckoutUrl ? (
                <a
                  href={fourthwallCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Pay Now
                </a>
              ) : (
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  Checkout URL is not configured yet.
                </p>
              )}
            </div>
          ) : null}
          {item.status === 'paid_pending_launch' ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              Payment verified via {item.payment_provider || 'gateway'}{item.paid_at ? ` on ${new Date(item.paid_at).toLocaleString()}` : ''}.
              {item.payment_reference ? ` Ref: ${item.payment_reference}` : ''}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
