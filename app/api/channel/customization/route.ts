import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function readNullableId(value: unknown) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId')?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const targetId = userId || user?.id || null;
  if (!targetId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: settings, error } = await supabase
    .from('channel_home_settings')
    .select('user_id,home_enabled,trailer_video_id,featured_video_id,updated_at')
    .eq('user_id', targetId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    settings: settings || {
      user_id: targetId,
      home_enabled: true,
      trailer_video_id: null,
      featured_video_id: null,
      updated_at: null,
    },
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    homeEnabled?: unknown;
    trailerVideoId?: unknown;
    featuredVideoId?: unknown;
  };

  const homeEnabled = readBoolean(body.homeEnabled, true);
  const trailerVideoId = readNullableId(body.trailerVideoId);
  const featuredVideoId = readNullableId(body.featuredVideoId);

  // Validate referenced videos belong to user (if set).
  const ids = [trailerVideoId, featuredVideoId].filter(Boolean) as string[];
  if (ids.length) {
    const { data: owned, error: ownedError } = await supabase
      .from('videos')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .in('id', ids);
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 400 });
    const ownedSet = new Set((owned || []).map((v) => String((v as { id: string }).id)));
    const invalid = ids.find((id) => !ownedSet.has(id));
    if (invalid) return NextResponse.json({ error: 'Invalid featured video selection.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('channel_home_settings')
    .upsert(
      {
        user_id: user.id,
        home_enabled: homeEnabled,
        trailer_video_id: trailerVideoId,
        featured_video_id: featuredVideoId,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id,home_enabled,trailer_video_id,featured_video_id,updated_at')
    .single();

  if (error) {
    const msg = error.message || 'Failed to save customization.';
    if (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('channel_home_settings')) {
      return NextResponse.json(
        {
          error:
            'Channel customization database tables are missing. Run the Supabase SQL patch: supabase/channel_home_customization_patch.sql',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ settings: data });
}
