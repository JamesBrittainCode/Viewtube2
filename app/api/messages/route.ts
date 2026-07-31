import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { normalizeHandle } from '@/lib/handle';
import { checkFamilyPermission } from '@/lib/family-controls';

type ProfileRow = {
  id: string;
  username: string | null;
  handle: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  top_streamer?: boolean | null;
  streak_champion?: boolean | null;
  is_admin?: boolean | null;
};

async function findProfileByTarget(adminClient: ReturnType<typeof createAdminClient>, target: string) {
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
          .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,is_admin')
          .eq('id', match.id)
          .maybeSingle();
        if (profileError) throw profileError;
        return profile as ProfileRow | null;
      }
      if (data.users.length < 1000) return null;
      page += 1;
    }
    return null;
  }

  const handle = normalizeHandle(clean);
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,is_admin')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

async function getFirstAdminProfile(adminClient: ReturnType<typeof createAdminClient>) {
  const { data: flaggedAdmin, error: flaggedError } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,is_admin')
    .eq('is_admin', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (flaggedError && flaggedError.code !== 'PGRST116') throw flaggedError;
  if (flaggedAdmin) return flaggedAdmin as ProfileRow;

  const adminEmail = 'jesuslearningclub@gmail.com';
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const adminUser = data.users.find((item) => item.email?.toLowerCase() === adminEmail);
  if (!adminUser) return null;

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,is_admin')
    .eq('id', adminUser.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return profile as ProfileRow | null;
}

export async function GET() {
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
  const { data: participations, error: participantError } = await adminClient
    .from('message_thread_participants')
    .select('thread_id,status,last_read_at,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (participantError) return NextResponse.json({ error: participantError.message }, { status: 400 });
  const threadIds = (participations || []).map((item) => item.thread_id);
  if (!threadIds.length) return NextResponse.json({ threads: [] });

  const [threadsResult, allParticipantsResult, latestMessagesResult] = await Promise.all([
    adminClient.from('message_threads').select('id,title,is_admin_thread,is_broadcast,created_by,created_at,updated_at').in('id', threadIds),
    adminClient.from('message_thread_participants').select('thread_id,user_id,status').in('thread_id', threadIds),
    adminClient
      .from('message_thread_messages')
      .select('id,thread_id,sender_id,body,is_admin_message,created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false }),
  ]);

  if (threadsResult.error) return NextResponse.json({ error: threadsResult.error.message }, { status: 400 });
  if (allParticipantsResult.error) return NextResponse.json({ error: allParticipantsResult.error.message }, { status: 400 });
  if (latestMessagesResult.error) return NextResponse.json({ error: latestMessagesResult.error.message }, { status: 400 });

  const userIds = Array.from(new Set((allParticipantsResult.data || []).map((item) => item.user_id)));
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,top_streamer,streak_champion,is_admin')
    .in('id', userIds);
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 });

  const participationByThread = new Map((participations || []).map((item) => [item.thread_id, item]));
  const profileById = new Map((profiles || []).map((item) => [item.id, item]));
  const participantsByThread = new Map<string, unknown[]>();
  for (const participant of allParticipantsResult.data || []) {
    const next = participantsByThread.get(participant.thread_id) || [];
    next.push({
      ...participant,
      profile: profileById.get(participant.user_id) || null,
    });
    participantsByThread.set(participant.thread_id, next);
  }

  const latestByThread = new Map<string, unknown>();
  for (const message of latestMessagesResult.data || []) {
    if (!latestByThread.has(message.thread_id)) latestByThread.set(message.thread_id, message);
  }

  const threads = (threadsResult.data || [])
    .map((thread) => ({
      ...thread,
      my_participant: participationByThread.get(thread.id),
      participants: participantsByThread.get(thread.id) || [],
      latest_message: latestByThread.get(thread.id) || null,
    }))
    .sort((a, b) => {
      if (a.is_admin_thread !== b.is_admin_thread) return a.is_admin_thread ? -1 : 1;
      const aPending = a.my_participant?.status === 'pending';
      const bPending = b.my_participant?.status === 'pending';
      if (aPending !== bPending) return aPending ? -1 : 1;
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const familyMessages = await checkFamilyPermission(user.id, 'messages');
  if (!familyMessages.allowed) {
    return NextResponse.json({ error: familyMessages.reason || 'Messages are disabled for this account.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    target?: string;
    toAdmin?: boolean;
    message?: string;
  };
  const message = String(body.message || '').trim();
  if (message.length < 1) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'Messages can be up to 5,000 characters.' }, { status: 400 });

  const adminClient = createAdminClient();
  const recipient = body.toAdmin
    ? await getFirstAdminProfile(adminClient)
    : await findProfileByTarget(adminClient, String(body.target || ''));

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
  const { error: participantsError } = await adminClient.from('message_thread_participants').insert([
    { thread_id: thread.id, user_id: user.id, status: 'accepted', last_read_at: new Date().toISOString() },
    { thread_id: thread.id, user_id: recipient.id, status: recipientStatus },
  ]);
  if (participantsError) return NextResponse.json({ error: participantsError.message }, { status: 400 });

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

  await adminClient.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);

  const senderName = senderProfile?.username || senderProfile?.handle || 'Someone';
  await sendNotification(supabase, {
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
