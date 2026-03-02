import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { isAdminEmail } from '@/lib/admin';
import { unwrapRelation } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  if (!isAdminEmail(user.email)) redirect('/');

  const nowIso = new Date().toISOString();

  const [{ data: current }, { data: next }] = await Promise.all([
    supabase
      .from('creator_spotlights')
      .select(
        'id,scheduled_for,videos:videos(id,title,thumbnail_url,profiles:profiles!videos_user_id_fkey(username))',
      )
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('creator_spotlights')
      .select(
        'id,scheduled_for,videos:videos(id,title,thumbnail_url,profiles:profiles!videos_user_id_fkey(username))',
      )
      .gt('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const currentVideo = unwrapRelation((current as { videos?: unknown } | null)?.videos as never);
  const nextVideo = unwrapRelation((next as { videos?: unknown } | null)?.videos as never);
  const currentChannel = unwrapRelation((currentVideo as { profiles?: unknown } | null)?.profiles as never);
  const nextChannel = unwrapRelation((nextVideo as { profiles?: unknown } | null)?.profiles as never);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="mb-4 text-2xl font-bold">ViewTube Studio</h1>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Creator Spotlight</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Current spotlight and next scheduled spotlight (Mondays at 1:00 AM PST).
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-500">Live now</h3>
            {current ? (
              <Link href={`/watch/${(currentVideo as { id?: string } | null)?.id || ''}`} className="mt-3 block">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  <Image
                    src={(currentVideo as { thumbnail_url?: string } | null)?.thumbnail_url || '/thumbnail-placeholder.svg'}
                    alt={(currentVideo as { title?: string } | null)?.title || 'Spotlight'}
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{(currentVideo as { title?: string } | null)?.title}</p>
                <p className="text-xs text-zinc-500">{(currentChannel as { username?: string } | null)?.username}</p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No spotlight video published yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-500">Next up</h3>
            {next ? (
              <Link href={`/watch/${(nextVideo as { id?: string } | null)?.id || ''}`} className="mt-3 block">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  <Image
                    src={(nextVideo as { thumbnail_url?: string } | null)?.thumbnail_url || '/thumbnail-placeholder.svg'}
                    alt={(nextVideo as { title?: string } | null)?.title || 'Next spotlight'}
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{(nextVideo as { title?: string } | null)?.title}</p>
                <p className="text-xs text-zinc-500">{(nextChannel as { username?: string } | null)?.username}</p>
                <p className="text-xs text-zinc-500">
                  Publishes: {new Date(next.scheduled_for).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT
                </p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No next spotlight scheduled yet.</p>
            )}
          </div>
        </div>
      </section>
      <AdminProfileManager />
    </div>
  );
}
