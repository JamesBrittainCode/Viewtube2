import type { MetadataRoute } from 'next';
import { createPublicClient } from '@/lib/supabase/public';

const MAX_URLS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const now = new Date();
  const supabase = createPublicClient();

  const [{ data: videos }, { data: channels }] = await Promise.all([
    supabase
      .from('videos')
      .select('id,created_at')
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .limit(MAX_URLS),
    supabase
      .from('profiles')
      .select('handle,updated_at')
      .not('handle', 'is', null)
      .order('subscribers_count', { ascending: false })
      .limit(MAX_URLS),
  ]);

  const items: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/trending`, lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${base}/live`, lastModified: now, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  for (const v of videos || []) {
    items.push({
      url: `${base}/watch/${v.id}`,
      lastModified: v.created_at ? new Date(v.created_at) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  for (const c of channels || []) {
    if (!c.handle) continue;
    items.push({
      url: `${base}/channel/${encodeURIComponent(c.handle)}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : now,
      changeFrequency: 'weekly',
      priority: 0.5,
    });
  }

  return items;
}

