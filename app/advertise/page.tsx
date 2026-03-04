import { AdvertiserIntakeForm } from '@/components/advertiser-intake-form';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Advertise on ViewTube',
  description: 'Launch a professionally reviewed ad campaign on ViewTube.',
};

export default async function AdvertisePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in?next=%2Fadvertise');
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-10">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 p-8 text-white shadow-sm dark:border-zinc-700">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">ViewTube Ads</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Reach your audience with premium video placement</h1>
        <p className="mt-3 max-w-3xl text-sm text-zinc-200 sm:text-base">
          Submit your ad campaign, choose your schedule, and provide payment confirmation. Every campaign is reviewed
          and approved before delivery to ensure quality and brand safety.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold">1. Submit Campaign</p>
          <p className="mt-1 text-xs text-zinc-500">Provide company details, creative assets, and destination link.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold">2. Payment Verification</p>
          <p className="mt-1 text-xs text-zinc-500">Pay in checkout after approval. Campaign launches after payment is confirmed.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold">3. Review & Launch</p>
          <p className="mt-1 text-xs text-zinc-500">ViewTube admin reviews, approves, and schedules your campaign.</p>
        </div>
      </section>

      <div className="flex justify-end">
        <Link
          href="/advertise/portal"
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Open Advertiser Portal
        </Link>
      </div>

      <AdvertiserIntakeForm />
    </main>
  );
}
