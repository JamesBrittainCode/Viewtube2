import Link from 'next/link';
import { Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Logo } from '@/components/logo';
import { NotificationMenu } from '@/components/notification-menu';
import { ProfileMenu } from '@/components/profile-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { unwrapRelation } from '@/lib/profile';

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let handle: string | null = null;
  let avatarUrl: string | null = null;
  let notifications: {
    id: string;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
    actor?: { username?: string; handle?: string; avatar_url?: string | null } | null;
  }[] = [];
  let unreadCount = 0;

  if (user) {
    const [{ data: profile }, { data: notificationsData }, { count }] = await Promise.all([
      supabase.from('profiles').select('handle, avatar_url').eq('id', user.id).single(),
      supabase
        .from('notifications')
        .select(
          'id,type,message,is_read,created_at,actor:profiles!notifications_actor_id_fkey(username,handle,avatar_url)',
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

    handle = profile?.handle ?? null;
    avatarUrl = profile?.avatar_url ?? null;
    notifications = (notificationsData || []).map((item) => ({
      id: item.id,
      type: item.type,
      message: item.message,
      is_read: item.is_read,
      created_at: item.created_at,
      actor: unwrapRelation(item.actor),
    }));
    unreadCount = count || 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        <Logo />

        <form action="/search" className="mx-auto w-full max-w-2xl">
          <input
            name="q"
            placeholder="Search"
            className="h-10 w-full rounded-full border border-zinc-300 bg-zinc-50 px-4 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </form>

        <ThemeToggle />

        {user && (
          <NotificationMenu
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
          />
        )}

        {user && (
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Link>
        )}

        {user ? (
          <ProfileMenu avatarUrl={avatarUrl} handle={handle} />
        ) : (
          <Link
            href="/sign-in"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
