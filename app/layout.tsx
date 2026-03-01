import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'ViewTube',
  description: 'Video-sharing platform built with Next.js and Supabase',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Navbar />
          <Sidebar />
          <main className="mx-auto max-w-[1600px] px-4 py-6 lg:ml-64 lg:px-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
