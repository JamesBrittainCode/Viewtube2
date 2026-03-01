import { NextResponse } from 'next/server';
import { normalizeHandle } from '@/lib/handle';
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

  const body = (await request.json()) as { username?: string; handle?: string; bio?: string };
  const username = body.username?.trim();
  const handle = normalizeHandle(body.handle || '');

  if (!username || username.length < 3) {
    return NextResponse.json({ error: 'Username too short' }, { status: 400 });
  }
  if (!body.handle) {
    return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      bio: body.bio?.trim() || null,
      handle,
    })
    .eq('id', user.id);

  if (error) {
    if (error.message.includes('idx_profiles_handle_unique') || error.message.includes('profiles_handle_key')) {
      return NextResponse.json({ error: 'Handle is already taken' }, { status: 400 });
    }
    if (error.message.includes('idx_profiles_username_lower_unique') || error.message.includes('profiles_username_key')) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
