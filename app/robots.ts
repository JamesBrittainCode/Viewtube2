import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/studio/',
          '/upload',
          '/sign-in',
          '/sign-up',
          '/reset-password',
          '/notifications',
          '/messages',
          '/watch-later',
          '/library',
          '/profile',
          '/playables',
          '/check-email',
          '/email-confirmed',
          '/suspended',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
