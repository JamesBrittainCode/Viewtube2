import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SupportForm } from '@/components/support-form';

export const metadata = {
  title: 'Support | ViewTube',
};

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Support</h1>
        <p className="text-sm text-zinc-400">
          Send a message to the ViewTube admin team. Your request shows up in Studio for review.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
        <SupportForm />
      </section>

      <p className="text-xs text-zinc-500">
        Prefer Studio? You can also use{' '}
        <Link href="/studio/feedback" className="text-zinc-200 underline underline-offset-2">
          Studio Feedback
        </Link>
        .
      </p>
    </div>
  );
}

