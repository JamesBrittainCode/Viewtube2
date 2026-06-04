import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const GAME_KEYS = new Set(['bubble-pop', 'memory-flip', 'signal-sprint']);

function readPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

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
  if (!GAME_KEYS.has(gameKey)) return NextResponse.json({ error: 'Unknown playable.' }, { status: 400 });

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
  return NextResponse.json({ progress: data });
}
