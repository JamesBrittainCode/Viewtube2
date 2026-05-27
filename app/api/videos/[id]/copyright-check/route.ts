import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type CopyrightCheckBody = {
  fingerprint?: string;
  durationSeconds?: number;
};

type AcoustIdRecording = {
  id?: string;
  title?: string;
  artists?: Array<{ name?: string }>;
};

type AcoustIdResponse = {
  status?: 'ok' | 'error';
  error?: { message?: string } | string;
  results?: Array<{
    score?: number;
    recordings?: AcoustIdRecording[];
  }>;
};

type MusicBrainzRecording = {
  id?: string;
  title?: string;
  'artist-credit'?: Array<{ name?: string; artist?: { name?: string } }>;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function readFirstRecording(payload: AcoustIdResponse | null) {
  const results = payload?.results || [];
  if (!results.length) return null;
  const best = results[0];
  const recordings = best?.recordings || [];
  if (!recordings.length) return null;
  const recording = recordings[0];
  const title = recording?.title?.trim() || null;
  const artist = recording?.artists?.[0]?.name?.trim() || null;
  const recordingId = recording?.id?.trim() || null;
  return { title, artist, recordingId };
}

async function lookupMusicBrainz(recordingId: string) {
  const url = new URL(`https://musicbrainz.org/ws/2/recording/${encodeURIComponent(recordingId)}`);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('inc', 'artists');

  const res = await fetch(url.toString(), {
    headers: {
      // MusicBrainz requires a User-Agent.
      'User-Agent': 'ViewTube/1.0 (https://viewtube.tv)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const payload = await safeJson<MusicBrainzRecording>(res);
  if (!payload) return null;

  const title = payload.title?.trim() || null;
  const artistCredit = payload['artist-credit'] || [];
  const firstCredit = artistCredit[0];
  const artist = firstCredit?.name?.trim() || firstCredit?.artist?.name?.trim() || null;
  return { title, artist };
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const videoId = String(id || '').trim();
  if (!videoId) return NextResponse.json({ error: 'Invalid video id' }, { status: 400 });

  const acoustIdKey = process.env.ACOUSTID_API_KEY;
  if (!acoustIdKey) {
    return NextResponse.json({ error: 'Missing ACOUSTID_API_KEY environment variable.' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: CopyrightCheckBody = {};
  try {
    body = (await _request.json()) as CopyrightCheckBody;
  } catch {
    body = {};
  }
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint.trim() : '';
  const durationSeconds = Number.isFinite(body.durationSeconds) ? Math.max(1, Math.round(body.durationSeconds || 0)) : 0;
  if (!fingerprint || !durationSeconds) {
    return NextResponse.json({ error: 'Missing fingerprint or durationSeconds.' }, { status: 400 });
  }

  const { data: video } = await supabase
    .from('videos')
    .select(
      'id,user_id,video_url,copyright_status,copyright_checked_at,copyright_detected,copyright_song_title,copyright_artist',
    )
    .eq('id', videoId)
    .maybeSingle();

  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  if (video.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const videoUrl = String(video.video_url || '').trim();
  if (!videoUrl) return NextResponse.json({ error: 'Video URL missing' }, { status: 400 });

  // Avoid spamming the API: if already checked in the last 24h, return existing state.
  const checkedAt = video.copyright_checked_at ? new Date(video.copyright_checked_at).getTime() : 0;
  if (checkedAt && Date.now() - checkedAt < 24 * 60 * 60 * 1000 && video.copyright_status && video.copyright_status !== 'pending') {
    return NextResponse.json({
      ok: true,
      reused: true,
      matched: Boolean(video.copyright_detected),
      song: video.copyright_detected
        ? { title: video.copyright_song_title || null, artist: video.copyright_artist || null, label: null }
        : null,
    });
  }

  await supabase
    .from('videos')
    .update({
      copyright_status: 'checking',
      copyright_checked_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('user_id', user.id);

  const url = new URL('https://api.acoustid.org/v2/lookup');
  url.searchParams.set('client', acoustIdKey);
  url.searchParams.set('meta', 'recordings');
  url.searchParams.set('duration', String(durationSeconds));
  url.searchParams.set('fingerprint', fingerprint);

  const res = await fetch(url.toString(), { method: 'GET' });
  const payload = (await safeJson<AcoustIdResponse>(res)) || null;
  const first = readFirstRecording(payload);
  let title = first?.title || null;
  let artist = first?.artist || null;
  const recordingId = first?.recordingId || null;

  if (recordingId && (!title || !artist)) {
    const mb = await lookupMusicBrainz(recordingId);
    title = title || mb?.title || null;
    artist = artist || mb?.artist || null;
  }

  const matched = Boolean(title || artist);

  const update = matched
    ? {
        copyright_status: 'matched',
        copyright_detected: true,
        copyright_song_title: title,
        copyright_artist: artist,
        copyright_label: null,
        copyright_isrc: null,
        copyright_upc: null,
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
          title,
          artist,
          label: null,
        }
      : null,
  });
}
