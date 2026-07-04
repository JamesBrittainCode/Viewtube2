import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { checkFamilyPermission } from '@/lib/family-controls';

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const familyMessages = await checkFamilyPermission(user.id, 'messages');
  if (!familyMessages.allowed) {
    return NextResponse.json({ error: familyMessages.reason || 'Messages are disabled for this account.' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data: myParticipant, error: myParticipantError } = await adminClient
    .from('message_thread_participants')
    .select('thread_id,user_id,status,last_read_at')
    .eq('thread_id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (myParticipantError) return NextResponse.json({ error: myParticipantError.message }, { status: 400 });
  if (!myParticipant) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const [threadResult, participantsResult, messagesResult] = await Promise.all([
    adminClient.from('message_threads').select('id,title,is_admin_thread,is_broadcast,created_by,created_at,updated_at').eq('id', threadId).single(),
    adminClient.from('message_thread_participants').select('thread_id,user_id,status,last_read_at').eq('thread_id', threadId),
    adminClient
      .from('message_thread_messages')
      .select('id,thread_id,sender_id,body,is_admin_message,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true }),
  ]);

  if (threadResult.error) return NextResponse.json({ error: threadResult.error.message }, { status: 400 });
  if (participantsResult.error) return NextResponse.json({ error: participantsResult.error.message }, { status: 400 });
  if (messagesResult.error) return NextResponse.json({ error: messagesResult.error.message }, { status: 400 });

  const userIds = Array.from(new Set((participantsResult.data || []).map((item) => item.user_id)));
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,is_admin')
    .in('id', userIds);
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 });

  const profileById = new Map((profiles || []).map((item) => [item.id, item]));
  const participants = (participantsResult.data || []).map((item) => ({
    ...item,
    profile: profileById.get(item.user_id) || null,
  }));

  await adminClient
    .from('message_thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('user_id', user.id);

  return NextResponse.json({
    thread: threadResult.data,
    myParticipant,
    participants,
    messages: messagesResult.data || [],
    currentUserId: user.id,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const familyMessages = await checkFamilyPermission(user.id, 'messages');
  if (!familyMessages.allowed) {
    return NextResponse.json({ error: familyMessages.reason || 'Messages are disabled for this account.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = String(body.message || '').trim();
  if (message.length < 1) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'Messages can be up to 5,000 characters.' }, { status: 400 });

  const adminClient = createAdminClient();
  const { data: myParticipant, error: myParticipantError } = await adminClient
    .from('message_thread_participants')
    .select('status')
    .eq('thread_id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (myParticipantError) return NextResponse.json({ error: myParticipantError.message }, { status: 400 });
  if (!myParticipant) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (myParticipant.status !== 'accepted') {
    return NextResponse.json({ error: 'Accept the message request before replying.' }, { status: 403 });
  }

  const { data: senderProfile } = await adminClient
    .from('profiles')
    .select('username,handle,is_admin')
    .eq('id', user.id)
    .maybeSingle();

  const { data: inserted, error: messageError } = await adminClient
    .from('message_thread_messages')
    .insert({
      thread_id: threadId,
      sender_id: user.id,
      body: message,
      is_admin_message: Boolean(senderProfile?.is_admin),
    })
    .select('id,thread_id,sender_id,body,is_admin_message,created_at')
    .single();
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 400 });

  await adminClient.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);

  const { data: recipients } = await adminClient
    .from('message_thread_participants')
    .select('user_id')
    .eq('thread_id', threadId)
    .neq('user_id', user.id);
  const senderName = senderProfile?.username || senderProfile?.handle || 'Someone';
  await Promise.all(
    (recipients || []).map((recipient) =>
      sendNotification(supabase, {
        userId: recipient.user_id,
        type: 'message',
        message: `New message from ${senderName}`,
        actorId: user.id,
        targetUrl: `/messages/${threadId}`,
      }),
    ),
  );

  return NextResponse.json({ message: inserted });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const familyMessages = await checkFamilyPermission(user.id, 'messages');
  if (!familyMessages.allowed) {
    return NextResponse.json({ error: familyMessages.reason || 'Messages are disabled for this account.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'accept') {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('message_thread_participants')
    .update({ status: 'accepted', last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('user_id', user.id)
    .select('thread_id,user_id,status,last_read_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ participant: data });
}
