'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { PointsCelebration } from '@/components/points-celebration';
import { Sidebar } from '@/components/sidebar';
import { SidebarProvider } from '@/components/sidebar-context';
import { StreakCelebration } from '@/components/streak-celebration';
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
  const [theaterActive, setTheaterActive] = useState(false);
  const prevCollapsedRef = useRef<boolean | null>(null);
  const prevTheaterCollapsedRef = useRef<boolean | null>(null);

  const isStudio = pathname.startsWith('/studio') || pathname.startsWith('/admin');
  const isAuthRoute =
    pathname.startsWith('/sign-') ||
    pathname.startsWith('/auth') ||
    pathname === '/reset-password' ||
    pathname === '/check-email' ||
    pathname === '/email-confirmed';

  useEffect(() => {
    const onShorts = pathname.startsWith('/shorts');
    if (theaterActive) return;
    if (onShorts) {
      if (prevCollapsedRef.current === null) prevCollapsedRef.current = collapsed;
      setCollapsed(true);
      return;
    }
    if (prevCollapsedRef.current !== null) {
      setCollapsed(prevCollapsedRef.current);
      prevCollapsedRef.current = null;
    }
  }, [collapsed, pathname, theaterActive]);

  useEffect(() => {
    function onTheaterMode(event: Event) {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setTheaterActive(active);
      document.documentElement.dataset.vtTheater = active ? 'true' : 'false';

      if (active) {
        if (prevTheaterCollapsedRef.current === null) prevTheaterCollapsedRef.current = collapsed;
        setCollapsed(true);
        return;
      }

      if (prevTheaterCollapsedRef.current !== null) {
        setCollapsed(prevTheaterCollapsedRef.current);
        prevTheaterCollapsedRef.current = null;
      }
    }

    window.addEventListener('vt-theater-mode-change', onTheaterMode);
    return () => {
      window.removeEventListener('vt-theater-mode-change', onTheaterMode);
      delete document.documentElement.dataset.vtTheater;
    };
  }, [collapsed]);

  if (isStudio || isAuthRoute) {
    return <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">{children}</main>;
  }

  return (
    <>
      <SidebarProvider value={{ collapsed, setCollapsed }}>
        <StreakCelebration />
        <PointsCelebration />
        {navbar}
        {!theaterActive && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />}
        <MobileBottomNav />
        <main
          className={cn(
            'mx-auto max-w-[1600px] px-4 py-4 pb-24 transition-[margin] duration-200 ease-out sm:py-6 lg:px-6 lg:pb-6',
            theaterActive ? 'max-w-none px-0 pt-0 sm:py-0 lg:ml-0 lg:px-0' : collapsed ? 'lg:ml-20' : 'lg:ml-64',
          )}
        >
          {children}
        </main>
      </SidebarProvider>
    </>
  );
}
