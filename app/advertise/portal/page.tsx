import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdvertiserPortal } from '@/components/advertiser-portal';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Advertiser Portal',
  description: 'Manage your ViewTube ad campaign submissions.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function AdvertiserPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/sign-in?next=%2Fadvertise%2Fportal');
  }

  const { data: submissions } = await supabase
    .from('ad_submissions')
    .select(
      'id,ad_title,company_name,status,calculated_price_usd,payment_amount_usd,payment_provider,payment_reference,paid_at,starts_at,ends_at,paypal_transaction_id,converted_ad_id,created_at',
    )
    .eq('submitter_email', user.email.toLowerCase())
    .order('created_at', { ascending: false });

  const launchedAdIds = (submissions || [])
    .map((item) => item.converted_ad_id)
    .filter((value): value is string => Boolean(value));

  const adMetricsById = new Map<
    string,
    { is_active: boolean; impressions_count: number; clicks_count: number; completions_count: number }
  >();

  if (launchedAdIds.length) {
    const { data: ads } = await supabase
      .from('ads')
      .select('id,is_active,impressions_count,clicks_count,completions_count')
      .in('id', launchedAdIds);

    for (const ad of ads || []) {
      adMetricsById.set(ad.id, {
        is_active: ad.is_active ?? false,
        impressions_count: ad.impressions_count ?? 0,
        clicks_count: ad.clicks_count ?? 0,
        completions_count: ad.completions_count ?? 0,
      });
    }
  }

  const enrichedSubmissions = (submissions || []).map((item) => {
    const metrics = item.converted_ad_id ? adMetricsById.get(item.converted_ad_id) : undefined;
    return {
      ...item,
      ad_is_active: metrics?.is_active ?? false,
      ad_impressions_count: metrics?.impressions_count ?? 0,
      ad_clicks_count: metrics?.clicks_count ?? 0,
      ad_completions_count: metrics?.completions_count ?? 0,
    };
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Advertiser Portal</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track review status and complete payment only after approval.
          </p>
        </div>
        <Link
          href="/advertise"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          New Campaign
        </Link>
      </div>

      {params.submitted === '1' ? (
        <p className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          Campaign submitted. We will review it before requesting payment.
        </p>
      ) : null}

      <AdvertiserPortal submissions={enrichedSubmissions} />
    </main>
  );
}
