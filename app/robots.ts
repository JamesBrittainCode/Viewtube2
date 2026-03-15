import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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

