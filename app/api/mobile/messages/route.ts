import { NextResponse } from 'next/server';
import { normalizeHandle } from '@/lib/handle';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';

async function getBearerUser(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function findProfile(adminClient: ReturnType<typeof createAdminClient>, target: string) {
  const clean = target.trim();
  if (!clean) return null;

  if (clean.includes('@') && !clean.startsWith('@')) {
    let page = 1;
    while (page <= 10) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const match = data.users.find((item) => item.email?.toLowerCase() === clean.toLowerCase());
      if (match) {
        const { data: profile, error: profileError } = await adminClient
          .from('profiles')
          .select('id,username,handle,is_admin')
          .eq('id', match.id)
          .maybeSingle();
        if (profileError) throw profileError;
        return profile;
      }
      if (data.users.length < 1000) return null;
      page += 1;
    }
    return null;
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle,is_admin')
    .eq('handle', normalizeHandle(clean))
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function firstAdmin(adminClient: ReturnType<typeof createAdminClient>) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle,is_admin')
    .eq('is_admin', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function POST(request: Request) {
  const user = await getBearerUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    target?: string;
    toAdmin?: boolean;
    message?: string;
  };
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'Messages can be up to 5,000 characters.' }, { status: 400 });

  const adminClient = createAdminClient();
  const recipient = body.toAdmin ? await firstAdmin(adminClient) : await findProfile(adminClient, String(body.target || ''));
  if (!recipient) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (recipient.id === user.id) return NextResponse.json({ error: 'You cannot message yourself.' }, { status: 400 });

  const { data: senderProfile } = await adminClient
    .from('profiles')
    .select('username,handle,is_admin')
    .eq('id', user.id)
    .maybeSingle();

  const { data: thread, error: threadError } = await adminClient
    .from('message_threads')
    .insert({
      title: body.toAdmin ? 'Message to ViewTube Admin' : null,
      is_admin_thread: Boolean(body.toAdmin || recipient.is_admin),
      created_by: user.id,
    })
    .select('id')
    .single();
  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 400 });

  const recipientStatus = body.toAdmin || recipient.is_admin ? 'accepted' : 'pending';
  const { error: participantError } = await adminClient.from('message_thread_participants').insert([
    { thread_id: thread.id, user_id: user.id, status: 'accepted', last_read_at: new Date().toISOString() },
    { thread_id: thread.id, user_id: recipient.id, status: recipientStatus },
  ]);
  if (participantError) return NextResponse.json({ error: participantError.message }, { status: 400 });

  const { data: inserted, error: messageError } = await adminClient
    .from('message_thread_messages')
    .insert({
      thread_id: thread.id,
      sender_id: user.id,
      body: message,
      is_admin_message: Boolean(senderProfile?.is_admin),
    })
    .select('id,thread_id,sender_id,body,is_admin_message,created_at')
    .single();
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 400 });

  const senderName = senderProfile?.username || senderProfile?.handle || 'Someone';
  await sendNotification(adminClient, {
    userId: recipient.id,
    type: recipientStatus === 'pending' ? 'message_request' : 'message',
    message: recipientStatus === 'pending' ? `New message request from ${senderName}` : `New message from ${senderName}`,
    actorId: user.id,
    targetUrl: `/messages/${thread.id}`,
    pushTitle: recipientStatus === 'pending' ? `Message request from ${senderName}` : `New message from ${senderName}`,
    pushBody: message,
  });

  return NextResponse.json({ threadId: thread.id, message: inserted });
}
