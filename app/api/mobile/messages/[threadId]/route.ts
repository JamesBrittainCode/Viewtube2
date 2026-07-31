import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

async function getBearerUser(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(request: Request, context: RouteContext) {
  const { threadId } = await context.params;
  const user = await getBearerUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = String(body.message || '').trim();
  if (message.length < 1) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'Messages can be up to 5,000 characters.' }, { status: 400 });

  const adminClient = createAdminClient();
  const { data: myParticipant, error: participantError } = await adminClient
    .from('message_thread_participants')
    .select('status')
    .eq('thread_id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (participantError) return NextResponse.json({ error: participantError.message }, { status: 400 });
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
      sendNotification(adminClient, {
        userId: recipient.user_id,
        type: 'message',
        message: `New message from ${senderName}`,
        actorId: user.id,
        targetUrl: `/messages/${threadId}`,
        pushTitle: `New message from ${senderName}`,
        pushBody: message,
      }),
    ),
  );

  return NextResponse.json({ message: inserted });
}
