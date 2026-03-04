import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adId = (searchParams.get('ad') || '').trim();
  const destination = (searchParams.get('to') || '').trim();

  if (!destination) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(destination);
    if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (adId) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase.from('ads').select('id,clicks_count').eq('id', adId).maybeSingle();
      if (data?.id) {
        await supabase
          .from('ads')
          .update({ clicks_count: (data.clicks_count || 0) + 1 })
          .eq('id', adId);
      }
    } catch (error) {
      console.error('Failed to track ad click', error);
    }
  }

  return NextResponse.redirect(redirectUrl);
}

