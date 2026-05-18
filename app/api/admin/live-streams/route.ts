import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    stream_id?: string;
    action?: 'pause' | 'resume' | 'end';
    reason?: string;
  };

  const streamId = String(body.stream_id || '').trim();
  const action = body.action;
  const reason = String(body.reason || '').trim().slice(0, 400);
  if (!streamId || !action) {
    return NextResponse.json({ error: 'stream_id and action are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: stream, error: streamErr } = await admin
    .from('live_streams')
    .select('id,user_id,is_live,is_paused')
    .eq('id', streamId)
    .maybeSingle();

  if (streamErr) return NextResponse.json({ error: streamErr.message }, { status: 400 });
  if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 });

  if (action === 'pause') {
    if (!stream.is_live) return NextResponse.json({ error: 'Stream is offline' }, { status: 400 });
    const { error } = await admin
      .from('live_streams')
      .update({
        is_paused: true,
        paused_reason: reason || 'Paused by admin',
        paused_at: new Date().toISOString(),
        paused_by: user.id,
      })
      .eq('id', streamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await sendNotification(supabase, {
      userId: stream.user_id,
      type: 'live_paused',
      message: `Your live stream was paused by an admin${reason ? `: ${reason}` : '.'}`,
      actorId: user.id,
      targetUrl: `/live/${streamId}`,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'resume') {
    const { error } = await admin
      .from('live_streams')
      .update({
        is_paused: false,
        paused_reason: null,
        paused_at: null,
        paused_by: null,
      })
      .eq('id', streamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'end') {
    const { error } = await admin
      .from('live_streams')
      .update({
        is_live: false,
        is_paused: false,
        paused_reason: null,
        paused_at: null,
        paused_by: null,
        ended_at: new Date().toISOString(),
        viewer_count: 0,
      })
      .eq('id', streamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await sendNotification(supabase, {
      userId: stream.user_id,
      type: 'live_ended_by_admin',
      message: `Your live stream was ended by an admin${reason ? `: ${reason}` : '.'}`,
      actorId: user.id,
      targetUrl: '/studio/live',
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

