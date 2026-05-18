import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';
import { AppShell } from '@/components/app-shell';
import { Navbar } from '@/components/navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { JsonLd } from '@/components/json-ld';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'ViewTube',
    template: '%s - ViewTube',
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {adsenseClient ? (
            <Script
              id="adsense"
              async
              strategy="afterInteractive"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
                adsenseClient,
              )}`}
              crossOrigin="anonymous"
            />
          ) : null}
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'ViewTube',
              url: siteUrl,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${siteUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }}
          />
          <AppShell navbar={<Navbar />}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
