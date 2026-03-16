import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const rawBase = (process.env.NEXT_PUBLIC_SITE_URL || 'https://viewtube.tv').replace(/\/+$/, '');
  // Guard against stale env values after domain changes.
  const base = rawBase.includes('viewtube.heyrivo.com') ? 'https://viewtube.tv' : rawBase;

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
          '/profile',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
