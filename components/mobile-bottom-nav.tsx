'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, Gamepad2, Home, Radio, UserRound, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/shorts', label: 'Shorts', icon: Smartphone },
  { href: '/playables', label: 'Play', icon: Gamepad2 },
  { href: '/subscriptions', label: 'Subs', icon: UserRound },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/live', label: 'Live', icon: Radio },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="grid grid-cols-6">
        {links.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 text-[11px]',
                active ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
