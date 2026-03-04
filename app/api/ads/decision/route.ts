import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eligible = searchParams.get('eligible') === '1';
  const fillRate = Number(process.env.AD_FILL_RATE || '0.35');

  if (!eligible || Math.random() > Math.min(1, Math.max(0, fillRate))) {
    return NextResponse.json({ ad: null });
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ ad: null });
  }
  const { data, error } = await supabase
    .from('ads')
    .select(
      'id,title,video_url,click_url,thumbnail_url,skippable,starts_at,ends_at,is_active,target_reach,impressions_count',
    )
    .eq('is_active', true)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data?.length) {
    return NextResponse.json({ ad: null });
  }

  const now = Date.now();
  const staleAdIds: string[] = [];
  const eligibleAds = data.filter((item) => {
    const starts = item.starts_at ? new Date(item.starts_at).getTime() : null;
    const ends = item.ends_at ? new Date(item.ends_at).getTime() : null;
    const reachedTarget =
      Boolean(item.target_reach && item.target_reach > 0 && (item.impressions_count || 0) >= item.target_reach);
    if (starts && now < starts) return false;
    if (ends && now >= ends) {
      staleAdIds.push(item.id);
      return false;
    }
    if (reachedTarget) {
      staleAdIds.push(item.id);
      return false;
    }
    return true;
  });

  if (staleAdIds.length) {
    const { error: deactivateError } = await supabase
      .from('ads')
      .update({ is_active: false })
      .in('id', staleAdIds);
    if (deactivateError) {
      console.error('Failed to deactivate stale ads', deactivateError);
    }
  }

  if (!eligibleAds.length) {
    return NextResponse.json({ ad: null });
  }

  const ad = eligibleAds[Math.floor(Math.random() * eligibleAds.length)];
  const nextImpressions = (ad.impressions_count || 0) + 1;
  const reachedTarget = Boolean(ad.target_reach && ad.target_reach > 0 && nextImpressions >= ad.target_reach);

  const { error: updateError } = await supabase
    .from('ads')
    .update({
      impressions_count: nextImpressions,
      last_served_at: new Date().toISOString(),
      is_active: reachedTarget ? false : ad.is_active,
    })
    .eq('id', ad.id);

  if (updateError) {
    console.error('Failed to update ad impression', updateError);
  }

  return NextResponse.json({ ad });
}
