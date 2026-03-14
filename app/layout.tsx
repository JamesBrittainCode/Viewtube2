import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Navbar } from '@/components/navbar';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'ViewTube',
    template: '%s | ViewTube',
  },
  description: 'Watch, upload, and share videos on ViewTube.',
  openGraph: {
    type: 'website',
    siteName: 'ViewTube',
    title: 'ViewTube',
    description: 'Watch, upload, and share videos on ViewTube.',
    images: ['/thumbnail-placeholder.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ViewTube',
    description: 'Watch, upload, and share videos on ViewTube.',
    images: ['/thumbnail-placeholder.svg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell navbar={<Navbar />}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
