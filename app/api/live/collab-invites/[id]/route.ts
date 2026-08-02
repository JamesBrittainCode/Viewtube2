import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type InviteAction = 'accept' | 'decline' | 'cancel';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { action?: InviteAction };
  const action = body.action;
  if (!action || !['accept', 'decline', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: invite, error } = await adminClient
    .from('live_collab_invites')
    .select('id,inviter_id,invitee_id,stream_id,title,description,scheduled_for,status,message')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!invite) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  if (user.id !== invite.inviter_id && user.id !== invite.invitee_id) {
    return NextResponse.json({ error: 'You cannot manage this invite.' }, { status: 403 });
  }

  if (action === 'cancel') {
    if (user.id !== invite.inviter_id) {
      return NextResponse.json({ error: 'Only the inviting creator can cancel this invite.' }, { status: 403 });
    }
    const { data, error: updateError } = await adminClient
      .from('live_collab_invites')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ invite: data });
  }

  if (user.id !== invite.invitee_id) {
    return NextResponse.json({ error: 'Only the invited creator can respond.' }, { status: 403 });
  }
  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'This invite has already been handled.' }, { status: 400 });
  }

  if (action === 'decline') {
    const { data, error: updateError } = await adminClient
      .from('live_collab_invites')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    await sendNotification(adminClient, {
      userId: invite.inviter_id,
      actorId: user.id,
      type: 'live_collab_invite',
      message: 'Your go-live-together invite was declined.',
      targetUrl: '/studio/live',
    }).catch(() => null);
    return NextResponse.json({ invite: data });
  }

  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select('id,can_stream_live')
    .in('id', [invite.inviter_id, invite.invitee_id]);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if ((profiles || []).some((profile) => !profile.can_stream_live) || (profiles || []).length < 2) {
    return NextResponse.json({ error: 'Both creators must still be eligible to go live.' }, { status: 403 });
  }

  const { data: stream, error: streamError } = await adminClient
    .from('live_streams')
    .insert({
      user_id: invite.inviter_id,
      co_host_id: invite.invitee_id,
      co_live_invite_id: invite.id,
      title: invite.title,
      description: invite.description,
      scheduled_for: invite.scheduled_for,
      is_live: false,
      viewer_count: 0,
    })
    .select('id')
    .single();
  if (streamError) return NextResponse.json({ error: streamError.message }, { status: 400 });

  const { data, error: updateError } = await adminClient
    .from('live_collab_invites')
    .update({ status: 'accepted', stream_id: stream.id, responded_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await sendNotification(adminClient, {
    userId: invite.inviter_id,
    actorId: user.id,
    type: 'live_collab_invite',
    message: 'Your go-live-together invite was accepted.',
    targetUrl: '/studio/live',
    pushTitle: 'Live together accepted',
    pushBody: 'Your co-host approved the invite.',
  }).catch(() => null);

  return NextResponse.json({ invite: data, stream });
}
