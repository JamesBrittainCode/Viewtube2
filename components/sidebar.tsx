import Link from 'next/link';
import { Flame, Folder, Home, PlaySquare, UserRound } from 'lucide-react';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/subscriptions', label: 'Subscriptions', icon: UserRound },
  { href: '/library', label: 'Library', icon: Folder },
  { href: '/trending', label: 'Trending', icon: Flame },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 border-r border-zinc-200 bg-zinc-50 p-3 lg:block dark:border-zinc-800 dark:bg-zinc-900/60">
      <nav className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
        <Link
          href="/upload"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <PlaySquare className="h-4 w-4" />
          Upload
        </Link>
      </nav>
    </aside>
  );
}
