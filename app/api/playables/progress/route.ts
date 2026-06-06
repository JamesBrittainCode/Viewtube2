import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function readPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

const builtInGameKeys = new Set(['flappy-dunk', 'tetris']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    gameKey?: string;
    score?: number;
    level?: number;
    stats?: Record<string, unknown>;
  };

  const gameKey = String(body.gameKey || '').trim();
  if (!gameKey) return NextResponse.json({ error: 'Unknown playable.' }, { status: 400 });

  const { data: game, error: gameError } = await supabase
    .from('playable_games')
    .select('slug,plays_count')
    .eq('slug', gameKey)
    .eq('is_active', true)
    .maybeSingle();

  if (gameError && !builtInGameKeys.has(gameKey)) return NextResponse.json({ error: gameError.message }, { status: 400 });
  if (!game && !builtInGameKeys.has(gameKey)) return NextResponse.json({ error: 'Unknown playable.' }, { status: 404 });

  const score = readPositiveInt(body.score, 0);
  const level = Math.max(1, readPositiveInt(body.level, 1));
  const stats = body.stats && typeof body.stats === 'object' ? body.stats : {};

  const { data: existing, error: existingError } = await supabase
    .from('playable_scores')
    .select('id,high_score,level,plays')
    .eq('user_id', user.id)
    .eq('game_key', gameKey)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });

  const payload = {
    user_id: user.id,
    game_key: gameKey,
    high_score: Math.max(Number(existing?.high_score || 0), score),
    level: Math.max(Number(existing?.level || 1), level),
    plays: Number(existing?.plays || 0) + 1,
    last_score: score,
    stats,
  };

  const query = existing?.id
    ? supabase.from('playable_scores').update(payload).eq('id', existing.id)
    : supabase.from('playable_scores').insert(payload);

  const { data, error } = await query
    .select('id,game_key,high_score,level,plays,last_score,stats,updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let streakAward = null;
  if (gameKey === 'flappy-dunk' && score > 0) {
    const { data: award } = await supabase.rpc('record_flappy_dunk_points', {
      score_value: score,
    });
    streakAward = award;
  }
  if (game) {
    await supabase
      .from('playable_games')
      .update({ plays_count: Number(game.plays_count || 0) + 1 })
      .eq('slug', gameKey);
  }
  return NextResponse.json({ progress: data, streakAward });
}
