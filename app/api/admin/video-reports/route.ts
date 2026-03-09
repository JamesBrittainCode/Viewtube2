import { NextResponse } from 'next/server';
import { canModerateUser } from '@/lib/admin';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type ReportAction = 'acknowledge' | 'dismiss' | 'takedown';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canModerateUser(supabase, { id: user.id, email: user.email }))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: reports, error } = await supabase
    .from('video_reports')
    .select(
      'id,video_id,reporter_id,reason,details,status,admin_note,resolution_action,resolved_at,resolved_by,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = reports || [];
  const videoIds = Array.from(new Set(list.map((r) => r.video_id)));
  const reporterIds = Array.from(new Set(list.map((r) => r.reporter_id)));

  const [videoRows, profileRows] = await Promise.all([
    videoIds.length
      ? supabase
          .from('videos')
          .select('id,title,video_url,thumbnail_url,user_id,is_removed,removed_reason,removed_at')
          .in('id', videoIds)
      : Promise.resolve({ data: [] as never[], error: null }),
    reporterIds.length
      ? supabase
          .from('profiles')
          .select('id,username,handle')
          .in('id', reporterIds)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  const videoMap = new Map((videoRows.data || []).map((row) => [row.id, row]));
  const reporterMap = new Map((profileRows.data || []).map((row) => [row.id, row]));

  const enriched = list.map((row) => ({
    ...row,
    video: videoMap.get(row.video_id) || null,
    reporter: reporterMap.get(row.reporter_id) || null,
  }));

  return NextResponse.json({ reports: enriched });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canModerateUser(supabase, { id: user.id, email: user.email }))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: ReportAction;
    admin_note?: string;
    takedown_message?: string;
  };
  const id = String(body.id || '').trim();
  const action = body.action;
  const adminNote = String(body.admin_note || '').trim().slice(0, 1000);
  const takedownMessage = String(body.takedown_message || '').trim().slice(0, 500);

  if (!id || !action || !['acknowledge', 'dismiss', 'takedown'].includes(action)) {
    return NextResponse.json({ error: 'id and valid action are required.' }, { status: 400 });
  }

  const { data: report, error: reportError } = await supabase
    .from('video_reports')
    .select('id,video_id,status')
    .eq('id', id)
    .maybeSingle();
  if (reportError || !report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  const nextStatus =
    action === 'acknowledge' ? 'acknowledged' : action === 'dismiss' ? 'dismissed' : 'resolved_takedown';

  const { error: updateError } = await supabase
    .from('video_reports')
    .update({
      status: nextStatus,
      admin_note: adminNote || null,
      resolution_action: action,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  if (action === 'takedown') {
    const adminSupabase = createAdminClient();
    const { data: video, error: videoFetchError } = await adminSupabase
      .from('videos')
      .select('id,user_id,title,is_removed')
      .eq('id', report.video_id)
      .maybeSingle();

    if (videoFetchError || !video) {
      return NextResponse.json({ error: 'Video not found for takedown.' }, { status: 404 });
    }

    if (!video.is_removed) {
      const { error: takedownError } = await adminSupabase
        .from('videos')
        .update({
          is_removed: true,
          removed_reason: takedownMessage || adminNote || 'Removed due to policy violation.',
          removed_at: new Date().toISOString(),
          removed_by: user.id,
        })
        .eq('id', video.id);
      if (takedownError) {
        return NextResponse.json({ error: takedownError.message }, { status: 400 });
      }
    }

    await sendNotification(supabase, {
      userId: video.user_id,
      type: 'video_takedown',
      message:
        `Your video "${video.title}" was removed by moderation.` +
        (takedownMessage ? ` Reason: ${takedownMessage}` : ''),
      targetUrl: '/studio/content',
    });
  }

  return NextResponse.json({ ok: true, id, status: nextStatus });
}
