import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eligible = searchParams.get('eligible') === '1';
  const fillRate = Number(process.env.AD_FILL_RATE || '0.35');

  if (!eligible || Math.random() > Math.min(1, Math.max(0, fillRate))) {
    return NextResponse.json({ ad: null });
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('ads')
    .select('id,title,video_url,click_url,thumbnail_url,skippable,starts_at,ends_at')
    .eq('is_active', true)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data?.length) {
    return NextResponse.json({ ad: null });
  }

  const now = Date.now();
  const eligibleAds = data.filter((item) => {
    const starts = item.starts_at ? new Date(item.starts_at).getTime() : null;
    const ends = item.ends_at ? new Date(item.ends_at).getTime() : null;
    if (starts && now < starts) return false;
    if (ends && now >= ends) return false;
    return true;
  });

  if (!eligibleAds.length) {
    return NextResponse.json({ ad: null });
  }

  const ad = eligibleAds[Math.floor(Math.random() * eligibleAds.length)];
  return NextResponse.json({ ad });
}
