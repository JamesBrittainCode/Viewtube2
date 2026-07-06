import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { AdblockGate } from '@/components/adblock-gate';
import { Navbar } from '@/components/navbar';
import { ThemeProvider } from '@/components/theme-provider';
import { ViewTubeIntro } from '@/components/viewtube-intro';
import { JsonLd } from '@/components/json-ld';
import { Analytics } from '@vercel/analytics/next';
import { absoluteUrl, getSiteUrl, siteDescription, siteName } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: siteName,
  generator: 'Next.js',
  title: {
    default: 'ViewTube - Watch Videos, Shorts, Live Streams, and Trailers',
    template: `%s - ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    'ViewTube',
    'videos',
    'shorts',
    'live streams',
    'trailers',
    'movies',
    'creator channels',
    'playlists',
  ],
  authors: [{ name: 'ViewTube' }],
  creator: 'ViewTube',
  publisher: 'ViewTube',
  category: 'video',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName,
    url: '/',
    title: 'ViewTube',
    description: siteDescription,
    images: [{ url: '/thumbnail-placeholder.svg', alt: 'ViewTube' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ViewTube',
    description: siteDescription,
    images: ['/thumbnail-placeholder.svg'],
  },
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = getSiteUrl();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AdblockGate />
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: siteName,
              url: siteUrl,
              description: siteDescription,
              publisher: {
                '@type': 'Organization',
                name: siteName,
                url: siteUrl,
                logo: absoluteUrl('/icon.svg'),
              },
              potentialAction: {
                '@type': 'SearchAction',
                target: `${siteUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }}
          />
          <AppShell navbar={<Navbar />}>{children}</AppShell>
          <ViewTubeIntro />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
