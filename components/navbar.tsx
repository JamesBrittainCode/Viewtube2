import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CreateMenu } from '@/components/create-menu';
import { Logo } from '@/components/logo';
import { NotificationMenu } from '@/components/notification-menu';
import { ProfileMenu } from '@/components/profile-menu';
import { SiteAlert } from '@/components/site-alert';
import { ThemeToggle } from '@/components/theme-toggle';
import { isAdminEmail } from '@/lib/admin';
import { unwrapRelation } from '@/lib/profile';

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let handle: string | null = null;
  let avatarUrl: string | null = null;
  let isModerator = false;
  let notifications: {
    id: string;
    type: string;
    message: string;
    target_url?: string | null;
    is_read: boolean;
    created_at: string;
    actor?: { username?: string; handle?: string; avatar_url?: string | null } | null;
  }[] = [];
  let unreadCount = 0;

  if (user) {
    const [profileRes, notificationsPrimary, countRes] = await Promise.all([
      supabase.from('profiles').select('handle, avatar_url, can_moderate').eq('id', user.id).single(),
      supabase
        .from('notifications')
        .select(
          'id,type,message,target_url,is_read,created_at,actor:profiles!notifications_actor_id_fkey(username,handle,avatar_url)',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
    ]);

    const notificationsData = notificationsPrimary.error
      ? (
          await supabase
            .from('notifications')
            .select(
              'id,type,message,is_read,created_at,actor:profiles!notifications_actor_id_fkey(username,handle,avatar_url)',
            )
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)
        ).data?.map((item) => ({ ...item, target_url: null }))
      : notificationsPrimary.data;

    handle = profileRes.data?.handle ?? null;
    avatarUrl = profileRes.data?.avatar_url ?? null;
    isModerator = Boolean(profileRes.data?.can_moderate);
    notifications = (notificationsData || []).map((item) => ({
      id: item.id,
      type: item.type,
      message: item.message,
      target_url: item.target_url,
      is_read: item.is_read,
      created_at: item.created_at,
      actor: unwrapRelation(item.actor),
    }));
    unreadCount = countRes.count || 0;
  }

  return (
    <>
      <SiteAlert />
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-4 sm:px-4 lg:px-6">
          <Logo />

          <form action="/search" className="mx-1 flex-1 sm:mx-auto sm:w-full sm:max-w-2xl">
            <input
              name="q"
              placeholder="Search"
              className="h-10 w-full rounded-full border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-zinc-400 sm:px-4 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </form>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Link
            href="/advertise"
            className="hidden rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 md:inline-flex dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Advertise
          </Link>

          {user && (
            <NotificationMenu
              initialNotifications={notifications}
              initialUnreadCount={unreadCount}
            />
          )}

          {user && <CreateMenu />}

          {user ? (
            <ProfileMenu
              avatarUrl={avatarUrl}
              handle={handle}
              isAdmin={isAdminEmail(user.email)}
              isModerator={isModerator}
            />
          ) : (
            <Link
              href="/sign-in"
              className="rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 sm:px-4 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
