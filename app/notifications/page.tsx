import Image from 'next/image';
import { redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { unwrapRelation } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: notifications } = await supabase
    .from('notifications')
    .select(
      'id,type,message,is_read,created_at,actor:profiles!notifications_actor_id_fkey(username,handle,avatar_url)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Notifications</h1>

      <div className="space-y-3">
        {(notifications || []).map((n) => {
          const actor = unwrapRelation(n.actor);
          return (
          <article
            key={n.id}
            className={`rounded-xl border p-4 ${n.is_read ? 'border-zinc-200 dark:border-zinc-700' : 'border-red-300 dark:border-red-700'}`}
          >
            <div className="flex items-start gap-3">
              <Image
                src={actor?.avatar_url || '/avatar-placeholder.svg'}
                alt={actor?.username || 'User'}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
              <div>
                <p className="text-sm">{n.message}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          </article>
          );
        })}

        {!(notifications || []).length && (
          <p className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No notifications yet.
          </p>
        )}
      </div>
    </section>
  );
}
