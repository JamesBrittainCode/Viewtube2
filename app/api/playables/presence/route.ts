import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function cleanKey(value: unknown) {
  return String(value || '')
    .trim()
    .slice(0, 80);
}

function activeSince() {
  return new Date(Date.now() - 90_000).toISOString();
}

async function countPlayers(supabase: Awaited<ReturnType<typeof createClient>>, gameKey: string) {
  const { count } = await supabase
    .from('playable_presence')
    .select('id', { count: 'exact', head: true })
    .eq('game_key', gameKey)
    .gte('last_seen_at', activeSince());

  return count || 0;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gameKey = cleanKey(new URL(request.url).searchParams.get('gameKey'));
  if (!gameKey) return NextResponse.json({ error: 'Unknown playable.' }, { status: 400 });

  await supabase.from('playable_presence').delete().lt('last_seen_at', new Date(Date.now() - 10 * 60_000).toISOString());

  return NextResponse.json({ playingNow: await countPlayers(supabase, gameKey) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { gameKey?: string; sessionId?: string };
  const gameKey = cleanKey(body.gameKey);
  const sessionId = cleanKey(body.sessionId);

  if (!gameKey || !sessionId) return NextResponse.json({ error: 'Unknown playable session.' }, { status: 400 });

  const { error } = await supabase.from('playable_presence').upsert(
    {
      user_id: user.id,
      game_key: gameKey,
      session_id: sessionId,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,game_key,session_id' },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ playingNow: await countPlayers(supabase, gameKey) });
}
