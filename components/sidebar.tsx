'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Flame, Folder, Gamepad2, Home, ListVideo, PlaySquare, Radio, UserRound, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/shorts', label: 'Shorts', icon: Smartphone },
  { href: '/playables', label: 'Playables', icon: Gamepad2 },
  { href: '/subscriptions', label: 'Subscriptions', icon: UserRound },
  { href: '/library', label: 'Library', icon: Folder },
  { href: '/watch-later', label: 'Watch later', icon: Clock },
  { href: '/playlists', label: 'Playlists', icon: ListVideo },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/upload', label: 'Upload', icon: PlaySquare },
] as const;

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-16 hidden h-[calc(100vh-4rem)] border-r border-zinc-200 bg-zinc-50 p-3 transition-[width] duration-200 ease-out lg:block dark:border-zinc-800 dark:bg-zinc-900/60',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center rounded-xl px-3 py-2 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800',
                collapsed ? 'justify-center gap-0' : 'gap-3',
              )}
              title={collapsed ? link.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  '',
                  'transition-all duration-200 ease-out',
                  collapsed ? 'w-0 overflow-hidden opacity-0' : 'w-auto opacity-100',
                )}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
