'use client';

import { createContext, useContext } from 'react';

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  value,
  children,
}: {
  value: SidebarContextValue;
  children: React.ReactNode;
}) {
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarOptional() {
  return useContext(SidebarContext);
}

