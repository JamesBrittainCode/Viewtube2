import { NextResponse } from 'next/server';
import { getHomeVideos, getPersonalizedHomeVideos } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const result = user?.id ? await getPersonalizedHomeVideos(page, user.id) : await getHomeVideos(page);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Failed to load feed' }, { status: 500 });
  }
}

