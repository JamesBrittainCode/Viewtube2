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
    .select('id,title,video_url,click_url,thumbnail_url,skippable')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    return NextResponse.json({ ad: null });
  }

  const ad = data[Math.floor(Math.random() * data.length)];
  return NextResponse.json({ ad });
}
