'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { cn } from '@/lib/utils';

export function AppShell({
  navbar,
  children,
}: {
  navbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isStudio = pathname.startsWith('/studio') || pathname.startsWith('/admin');

  if (isStudio) {
    return <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">{children}</main>;
  }

  return (
    <>
      {navbar}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <main
        className={cn(
          'mx-auto max-w-[1600px] px-4 py-6 transition-[margin-left] duration-300 ease-out lg:px-6',
          collapsed ? 'lg:ml-20' : 'lg:ml-64',
        )}
      >
        {children}
      </main>
    </>
  );
}
