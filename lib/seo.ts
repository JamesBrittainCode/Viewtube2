export const siteName = 'ViewTube';
export const siteDescription =
  'Watch videos, shorts, trailers, live streams, and creator channels on ViewTube.';

export function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || 'https://viewtube.tv').replace(/\/+$/, '');
  return raw.includes('viewtube.heyrivo.com') ? 'https://viewtube.tv' : raw;
}

export function absoluteUrl(path = '/') {
  const base = getSiteUrl();
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function truncateDescription(value?: string | null, fallback = siteDescription) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return (clean || fallback).slice(0, 160);
}
