'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

type Notification = {
  id: string;
  type: string;
  message: string;
  target_url?: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    username?: string;
    handle?: string;
    avatar_url?: string | null;
  } | null;
};

export function NotificationMenu({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: Notification[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      const target = event.target as Node;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH' });
    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="relative rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <button onClick={markAllRead} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className={`rounded-lg border ${n.is_read ? 'border-zinc-200 dark:border-zinc-700' : 'border-red-300 dark:border-red-700'}`}>
                <Link
                  href={n.target_url || '/notifications'}
                  className="block p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={() => setOpen(false)}
                >
                  <div className="flex items-start gap-2">
                    <Image
                      src={n.actor?.avatar_url || '/avatar-placeholder.svg'}
                      alt={n.actor?.username || 'User'}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{n.message}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
            {!notifications.length && (
              <p className="py-6 text-center text-sm text-zinc-500">No notifications yet.</p>
            )}
          </div>

          <Link href="/notifications" className="mt-3 block rounded-lg bg-zinc-100 px-3 py-2 text-center text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
