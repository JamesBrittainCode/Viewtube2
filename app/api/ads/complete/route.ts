import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { adId?: string };
  const adId = String(body.adId || '').trim();
  if (!adId) {
    return NextResponse.json({ error: 'adId is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from('ads').select('id,completions_count').eq('id', adId).maybeSingle();
    if (data?.id) {
      await supabase
        .from('ads')
        .update({ completions_count: (data.completions_count || 0) + 1 })
        .eq('id', adId);
    }
  } catch (error) {
    console.error('Failed to track ad completion', error);
  }

  return NextResponse.json({ ok: true });
}

