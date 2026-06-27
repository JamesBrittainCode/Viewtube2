import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  const to = (searchParams.get('to') || '').trim();

  let destination = '/';
  try {
    destination = new URL(to).toString();
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (id) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase.from('banner_ads').select('clicks_count').eq('id', id).maybeSingle();
      if (data) {
        await supabase
          .from('banner_ads')
          .update({ clicks_count: (data.clicks_count || 0) + 1 })
          .eq('id', id);
      }
    } catch {
      // Best-effort click tracking.
    }
  }

  return NextResponse.redirect(destination);
}
