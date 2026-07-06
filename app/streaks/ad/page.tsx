import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdRewardWatch } from '@/components/ad-reward-watch';

export const runtime = 'edge';

export const metadata = {
  title: 'Watch ad for points',
  description: 'Earn ViewTube points by watching an eligible ad.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function StreakAdRewardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in?redirect=/streaks/ad');

  const slot =
    process.env.NEXT_PUBLIC_ADSENSE_REWARD_SLOT ||
    process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT ||
    null;

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-[1100px]">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/streaks" className="underline">
            Streaks
          </Link>{' '}
          / Watch ad
        </div>
      </div>
      <AdRewardWatch seconds={60} slot={slot} />
    </div>
  );
}
