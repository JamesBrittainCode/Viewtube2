import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { sendAdminMessageEmail } from '@/lib/email';
import { normalizeHandle } from '@/lib/handle';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type AuthUserLite = {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
};

type TargetProfile = {
  id: string;
  username?: string | null;
  handle?: string | null;
};

async function listAuthUsers(adminClient: ReturnType<typeof createAdminClient>) {
  const users: AuthUserLite[] = [];
  let page = 1;
  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.map((user) => ({
      id: user.id,
      email: user.email || undefined,
      last_sign_in_at: user.last_sign_in_at,
    })));
    if (data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

async function findProfile(adminClient: ReturnType<typeof createAdminClient>, authUsers: AuthUserLite[], target: string) {
  const clean = target.trim();
  if (!clean) return null;

  if (clean.includes('@') && !clean.startsWith('@')) {
    const authUser = authUsers.find((item) => item.email?.toLowerCase() === clean.toLowerCase());
    if (!authUser) return null;
    const { data, error } = await adminClient
      .from('profiles')
      .select('id,username,handle')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) throw error;
    return data as TargetProfile | null;
  }

  const handle = normalizeHandle(clean);
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data as TargetProfile | null;
}

function shouldEmail(lastSignInAt?: string | null) {
  if (!lastSignInAt) return true;
  const last = new Date(lastSignInAt).getTime();
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= 7 * 24 * 60 * 60 * 1000;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: 'user' | 'all';
    target?: string;
    title?: string;
    message?: string;
    forceEmail?: boolean;
  };

  const mode = body.mode === 'all' ? 'all' : 'user';
  const message = String(body.message || '').trim();
  const title = String(body.title || 'Message from ViewTube Admin').trim().slice(0, 120);
  const forceEmail = body.forceEmail === true;
  if (!message) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'Messages can be up to 5,000 characters.' }, { status: 400 });
  if (mode === 'user' && !String(body.target || '').trim()) {
    return NextResponse.json({ error: 'Enter a handle or email.' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const authUsers = await listAuthUsers(adminClient);
  const authById = new Map(authUsers.map((item) => [item.id, item]));

  let recipients: TargetProfile[] = [];
  if (mode === 'all') {
    const { data, error } = await adminClient
      .from('profiles')
      .select('id,username,handle')
      .neq('id', user.id)
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    recipients = data || [];
  } else {
    const target = await findProfile(adminClient, authUsers, String(body.target || ''));
    if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (target.id === user.id) return NextResponse.json({ error: 'You cannot send an admin message to yourself.' }, { status: 400 });
    recipients = [target];
  }

  const createdThreadIds: string[] = [];
  let emailCount = 0;

  for (const recipient of recipients) {
    const { data: thread, error: threadError } = await adminClient
      .from('message_threads')
      .insert({
        title,
        is_admin_thread: true,
        is_broadcast: mode === 'all',
        created_by: user.id,
      })
      .select('id')
      .single();
    if (threadError) return NextResponse.json({ error: threadError.message }, { status: 400 });

    const { error: participantsError } = await adminClient.from('message_thread_participants').insert([
      { thread_id: thread.id, user_id: user.id, status: 'accepted', last_read_at: new Date().toISOString() },
      { thread_id: thread.id, user_id: recipient.id, status: 'accepted' },
    ]);
    if (participantsError) return NextResponse.json({ error: participantsError.message }, { status: 400 });

    const { error: messageError } = await adminClient.from('message_thread_messages').insert({
      thread_id: thread.id,
      sender_id: user.id,
      body: message,
      is_admin_message: true,
    });
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 400 });

    createdThreadIds.push(thread.id);
    await sendNotification(supabase, {
      userId: recipient.id,
      type: 'admin_message',
      message: 'New message from ViewTube Admin',
      actorId: user.id,
      targetUrl: `/messages/${thread.id}`,
      pushTitle: 'New message from ViewTube Admin',
      pushBody: 'Open ViewTube to read the full message.',
    });

    const authUser = authById.get(recipient.id);
    if (authUser?.email && (forceEmail || shouldEmail(authUser.last_sign_in_at))) {
      try {
        await sendAdminMessageEmail({
          to: authUser.email,
          messageUrl: `/messages/${thread.id}`,
        });
        emailCount += 1;
      } catch (error) {
        console.error('Failed to send admin message email', error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    emailsSent: emailCount,
    threadIds: createdThreadIds,
  });
}
