import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient();
  const { data: videos, error } = await adminSupabase
    .from('videos')
    .select('id,user_id,title,thumbnail_url,video_url,views,is_removed,removed_reason,removed_at,created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userIds = Array.from(new Set((videos || []).map((video) => video.user_id)));
  const { data: profiles } = userIds.length
    ? await adminSupabase
        .from('profiles')
        .select('id,username,handle')
        .in('id', userIds)
    : { data: [] as { id: string; username: string; handle: string }[] };

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const merged = (videos || []).map((video) => ({
    ...video,
    profile: profileMap.get(video.user_id) || null,
  }));

  return NextResponse.json({ videos: merged });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: 'takedown' | 'restore';
    reason?: string;
  };
  const id = String(body.id || '').trim();
  const action = body.action || 'takedown';
  const reason = String(body.reason || '').trim().slice(0, 600);
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (action === 'takedown' && !reason) {
    return NextResponse.json({ error: 'Reason is required for takedown.' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: video, error: videoError } = await adminSupabase
    .from('videos')
    .select('id,user_id,title,is_removed')
    .eq('id', id)
    .maybeSingle();

  if (videoError || !video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  if (action === 'takedown') {
    const { error: updateError } = await adminSupabase
      .from('videos')
      .update({
        is_removed: true,
        removed_reason: reason,
        removed_at: new Date().toISOString(),
        removed_by: user.id,
      })
      .eq('id', id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    await sendNotification(supabase, {
      userId: video.user_id,
      type: 'video_takedown',
      message: `Your video "${video.title}" was removed by admin. Reason: ${reason}`,
      targetUrl: '/studio/content',
    });
  } else {
    const { error: updateError } = await adminSupabase
      .from('videos')
      .update({
        is_removed: false,
        removed_reason: null,
        removed_at: null,
        removed_by: null,
      })
      .eq('id', id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id, action });
}

