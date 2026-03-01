import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { username?: string; bio?: string };
  const username = body.username?.trim();

  if (!username || username.length < 3) {
    return NextResponse.json({ error: 'Username too short' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      bio: body.bio?.trim() || null,
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
