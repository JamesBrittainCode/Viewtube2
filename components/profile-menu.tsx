'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { displayHandle } from '@/lib/handle';

type Props = {
  avatarUrl?: string | null;
  handle?: string | null;
  isAdmin?: boolean;
  isModerator?: boolean;
};

export function ProfileMenu({ avatarUrl, handle, isAdmin = false, isModerator = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="rounded-full border border-zinc-200 dark:border-zinc-700"
      >
        <Image
          src={avatarUrl || '/avatar-placeholder.svg'}
          alt="Profile"
          width={36}
          height={36}
          className="h-9 w-9 rounded-full object-cover"
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="px-3 py-2 text-sm text-zinc-500">{displayHandle(handle)}</div>
          <Link
            href="/studio/settings/customization"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Channel customization
          </Link>
          <Link
            href="/studio"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ViewTube Studio
          </Link>
          {(isAdmin || isModerator) && (
            <Link
              href="/studio/admin"
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {isAdmin ? 'Studio Admin' : 'Moderation'}
            </Link>
          )}
          {handle && (
            <Link
              href={`/channel/${handle}`}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Your channel
            </Link>
          )}
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            onClick={signOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
          <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-1 text-xs text-zinc-500">
            <a
              href="https://store.heyrivo.com/collections/viewtube"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Store
            </a>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/support" className="hover:underline">
              Support
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
