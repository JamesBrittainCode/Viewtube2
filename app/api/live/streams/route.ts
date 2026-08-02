import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordViewtubeActivity } from '@/lib/streaks';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('live_streams')
    .select(
      'id,user_id,title,description,thumbnail_url,source,ingest_stream_name,is_live,viewer_count,started_at,profiles:profiles!live_streams_user_id_fkey(username,handle,avatar_url,verified,is_admin,top_streamer,streak_champion)',
    )
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ streams: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,can_stream_live')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!profile.can_stream_live) {
    return NextResponse.json(
      { error: 'Live streaming is not enabled for this account.' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string;
    collabInviteId?: string;
  };
  const title = String(body.title || 'Live Stream').trim().slice(0, 120) || 'Live Stream';
  const description = String(body.description || '').trim().slice(0, 1000);

  const { data: existing } = await supabase
    .from('live_streams')
    .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at')
    .eq('user_id', user.id)
    .eq('is_live', true)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ stream: existing });
  }

  const collabInviteId = String(body.collabInviteId || '').trim();
  if (collabInviteId) {
    const { data: invite, error: inviteError } = await supabase
      .from('live_collab_invites')
      .select('id,inviter_id,invitee_id,stream_id,title,description,scheduled_for,status')
      .eq('id', collabInviteId)
      .maybeSingle();
    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Co-live invite not found.' }, { status: 404 });
    }
    if (invite.inviter_id !== user.id) {
      return NextResponse.json({ error: 'Only the inviting creator can start this co-live.' }, { status: 403 });
    }
    if (invite.status !== 'accepted') {
      return NextResponse.json({ error: 'The other creator must accept before you can start.' }, { status: 400 });
    }

    if (invite.stream_id) {
      const { data: stream, error: streamError } = await supabase
        .from('live_streams')
        .update({
          is_live: true,
          started_at: new Date().toISOString(),
          ended_at: null,
          title: invite.title,
          description: invite.description,
          viewer_count: 0,
        })
        .eq('id', invite.stream_id)
        .eq('user_id', user.id)
        .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at')
        .single();
      if (streamError) return NextResponse.json({ error: streamError.message }, { status: 400 });
      const streak = await recordViewtubeActivity(supabase, 'go_live', { targetId: stream.id, pointsOk: false });
      return NextResponse.json({ stream, streak });
    }

    const { data: stream, error: streamError } = await supabase
      .from('live_streams')
      .insert({
        user_id: user.id,
        co_host_id: invite.invitee_id,
        co_live_invite_id: invite.id,
        title: invite.title,
        description: invite.description,
        scheduled_for: invite.scheduled_for,
        is_live: true,
        viewer_count: 0,
      })
      .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at')
      .single();
    if (streamError) return NextResponse.json({ error: streamError.message }, { status: 400 });
    await supabase.from('live_collab_invites').update({ stream_id: stream.id }).eq('id', invite.id);
    const streak = await recordViewtubeActivity(supabase, 'go_live', { targetId: stream.id, pointsOk: false });
    return NextResponse.json({ stream, streak });
  }

  const { data, error } = await supabase
    .from('live_streams')
    .insert({
      user_id: user.id,
      title,
      description,
      is_live: true,
      viewer_count: 0,
    })
    .select('id,user_id,title,description,thumbnail_url,is_live,viewer_count,started_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Only award go-live points after the stream has been live for at least 5 minutes (enforced on end).
  const streak = await recordViewtubeActivity(supabase, 'go_live', { targetId: data.id, pointsOk: false });
  return NextResponse.json({ stream: data, streak });
}
