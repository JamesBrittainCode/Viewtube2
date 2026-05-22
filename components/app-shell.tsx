'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { Sidebar } from '@/components/sidebar';
import { SidebarProvider } from '@/components/sidebar-context';
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
  const isAuthRoute =
    pathname.startsWith('/sign-') ||
    pathname.startsWith('/auth') ||
    pathname === '/reset-password' ||
    pathname === '/check-email' ||
    pathname === '/email-confirmed';

  if (isStudio || isAuthRoute) {
    return <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">{children}</main>;
  }

  return (
    <>
      <SidebarProvider value={{ collapsed, setCollapsed }}>
        {navbar}
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <MobileBottomNav />
        <main
          className={cn(
            'mx-auto max-w-[1600px] px-4 py-4 pb-24 transition-[margin] duration-200 ease-out sm:py-6 lg:px-6 lg:pb-6',
            collapsed ? 'lg:ml-20' : 'lg:ml-64',
          )}
        >
          {children}
        </main>
      </SidebarProvider>
    </>
  );
}
