import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type AudDResult = {
  artist?: string;
  title?: string;
  album?: string;
  label?: string;
  release_date?: string;
  timecode?: string;
  song_link?: string;
  isrc?: string;
  upc?: string;
};

type AudDResponse = {
  status?: string;
  result?: AudDResult | null;
  error?: { error_code?: number; error_message?: string } | string;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const videoId = String(id || '').trim();
  if (!videoId) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });

  const token = process.env.AUDD_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          'Missing AUDD_API_TOKEN environment variable. Add an AudD API token to enable copyright checks.',
      },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: video } = await supabase
    .from('videos')
    .select('id,user_id,video_url,copyright_status,copyright_checked_at')
    .eq('id', videoId)
    .maybeSingle();

  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  if (video.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const videoUrl = String(video.video_url || '').trim();
  if (!videoUrl) return NextResponse.json({ error: 'Video URL missing' }, { status: 400 });

  // Avoid spamming the API: if already checked in the last 24h, return existing state.
  const checkedAt = video.copyright_checked_at ? new Date(video.copyright_checked_at).getTime() : 0;
  if (checkedAt && Date.now() - checkedAt < 24 * 60 * 60 * 1000 && video.copyright_status && video.copyright_status !== 'pending') {
    return NextResponse.json({ ok: true, reused: true });
  }

  await supabase
    .from('videos')
    .update({
      copyright_status: 'checking',
      copyright_checked_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('user_id', user.id);

  const form = new FormData();
  form.set('api_token', token);
  form.set('url', videoUrl);
  // Request core metadata (title/artist/label/isrc/upc). Keep minimal.
  const res = await fetch('https://api.audd.io/', { method: 'POST', body: form });
  const payload = (await safeJson<AudDResponse>(res)) || {};

  const result = payload && payload.result ? payload.result : null;
  const matched = Boolean(result && (result.title || result.artist));

  const update = matched
    ? {
        copyright_status: 'matched',
        copyright_detected: true,
        copyright_song_title: result?.title || null,
        copyright_artist: result?.artist || null,
        copyright_label: result?.label || null,
        copyright_isrc: result?.isrc || null,
        copyright_upc: result?.upc || null,
        copyright_raw: payload as unknown,
        copyright_checked_at: new Date().toISOString(),
      }
    : {
        copyright_status: 'clean',
        copyright_detected: false,
        copyright_song_title: null,
        copyright_artist: null,
        copyright_label: null,
        copyright_isrc: null,
        copyright_upc: null,
        copyright_raw: payload as unknown,
        copyright_checked_at: new Date().toISOString(),
      };

  const { error } = await supabase.from('videos').update(update).eq('id', videoId).eq('user_id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    matched,
    song: matched
      ? {
          title: result?.title || null,
          artist: result?.artist || null,
          label: result?.label || null,
        }
      : null,
  });
}

