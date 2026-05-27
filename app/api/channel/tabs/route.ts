import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

function readBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
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

  const { data, error } = await supabase
    .from('channel_tab_settings')
    .select('user_id,show_home,show_videos,show_shorts,show_playlists,updated_at')
    .eq('user_id', targetId)
    .maybeSingle();

  if (error) {
    const msg = error.message || 'Failed to load tab settings.';
    if (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('channel_tab_settings')) {
      return NextResponse.json(
        { error: 'Channel tab settings table is missing. Run supabase/channel_tabs_patch.sql' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({
    tabs:
      data || {
        user_id: targetId,
        show_home: true,
        show_videos: true,
        show_shorts: true,
        show_playlists: true,
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
    showHome?: unknown;
    showVideos?: unknown;
    showShorts?: unknown;
    showPlaylists?: unknown;
  };

  // Prevent users from hiding every tab.
  const next = {
    show_home: readBoolean(body.showHome, true),
    show_videos: readBoolean(body.showVideos, true),
    show_shorts: readBoolean(body.showShorts, true),
    show_playlists: readBoolean(body.showPlaylists, true),
  };
  if (!next.show_home && !next.show_videos && !next.show_shorts && !next.show_playlists) {
    return NextResponse.json({ error: 'At least one tab must be enabled.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('channel_tab_settings')
    .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' })
    .select('user_id,show_home,show_videos,show_shorts,show_playlists,updated_at')
    .single();

  if (error) {
    const msg = error.message || 'Failed to save tab settings.';
    if (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('channel_tab_settings')) {
      return NextResponse.json(
        { error: 'Channel tab settings table is missing. Run supabase/channel_tabs_patch.sql' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ tabs: data });
}

