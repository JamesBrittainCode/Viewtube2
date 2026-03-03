import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SuspendedSignOut } from '@/components/suspended-signout';

export default async function SuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('suspended,suspension_reason')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.suspended) redirect('/');

  return (
    <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-3xl font-bold">Account Suspended</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Your account has been suspended for policy violations.
      </p>
      {profile.suspension_reason && (
        <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Reason: {profile.suspension_reason}
        </p>
      )}
      <p className="mt-4 text-sm text-zinc-500">
        If you believe this is a mistake, contact{' '}
        <a className="font-medium underline" href="mailto:support@viewtube.heyrivo.com">
          support@viewtube.heyrivo.com
        </a>
        .
      </p>

      <div className="mt-6">
        <SuspendedSignOut />
      </div>
    </section>
  );
}
