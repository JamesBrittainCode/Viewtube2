'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Props = {
  avatarUrl?: string | null;
  username?: string | null;
  handle?: string | null;
  isAdmin?: boolean;
};

export function ProfileMenu({ avatarUrl, username, handle, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <div className="relative">
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
          <div className="px-3 py-2 text-sm text-zinc-500">{handle || '@user'}</div>
          <Link href="/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Your profile
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Admin settings
            </Link>
          )}
          {username && (
            <Link
              href={`/channel/${username}`}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Your channel
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
