import { NextResponse } from 'next/server';
import { VIDEO_REPORT_REASONS } from '@/lib/media-moderation';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    reason?: string;
    details?: string;
  };
  const reason = String(body.reason || '').trim();
  const details = String(body.details || '').trim().slice(0, 1000);

  if (!VIDEO_REPORT_REASONS.includes(reason as (typeof VIDEO_REPORT_REASONS)[number])) {
    return NextResponse.json({ error: 'Invalid report reason.' }, { status: 400 });
  }

  const { data: video } = await supabase
    .from('videos')
    .select('id')
    .eq('id', id)
    .eq('is_removed', false)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('video_reports')
    .upsert(
      {
        video_id: id,
        reporter_id: user.id,
        reason,
        details,
        status: 'open',
        admin_note: null,
        resolution_action: null,
        resolved_at: null,
        resolved_by: null,
      },
      { onConflict: 'video_id,reporter_id' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

