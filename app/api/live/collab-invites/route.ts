import { NextResponse } from 'next/server';
import { normalizeHandle } from '@/lib/handle';
import { sendCoLiveInviteEmail } from '@/lib/email';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type AuthUserLite = {
  id: string;
  email?: string;
};

type InviteRow = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  stream_id?: string | null;
  title: string;
  description: string;
  scheduled_for: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string;
  created_at: string;
  responded_at?: string | null;
};

async function listAuthUsers(adminClient: ReturnType<typeof createAdminClient>) {
  const users: AuthUserLite[] = [];
  let page = 1;
  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.map((user) => ({ id: user.id, email: user.email || undefined })));
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
      .select('id,username,handle,avatar_url,can_stream_live')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const handle = normalizeHandle(clean);
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,can_stream_live')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function attachProfiles(adminClient: ReturnType<typeof createAdminClient>, rows: InviteRow[]) {
  const ids = Array.from(new Set(rows.flatMap((row) => [row.inviter_id, row.invitee_id])));
  if (!ids.length) return rows.map((row) => ({ ...row, inviter: null, invitee: null }));
  const { data, error } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,is_admin,can_stream_live')
    .in('id', ids);
  if (error) throw error;
  const byId = new Map((data || []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({
    ...row,
    inviter: byId.get(row.inviter_id) || null,
    invitee: byId.get(row.invitee_id) || null,
  }));
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('live_collab_invites')
    .select('id,inviter_id,invitee_id,stream_id,title,description,scheduled_for,status,message,created_at,responded_at')
    .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
    .order('scheduled_for', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const invites = await attachProfiles(adminClient, (data || []) as InviteRow[]);
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    invitee?: string;
    title?: string;
    description?: string;
    scheduled_for?: string;
    message?: string;
  };
  const inviteeTarget = String(body.invitee || '').trim();
  const title = String(body.title || 'Live together on ViewTube').trim().slice(0, 120);
  const description = String(body.description || '').trim().slice(0, 1000);
  const message = String(body.message || '').trim().slice(0, 500);
  const scheduledAt = new Date(String(body.scheduled_for || ''));

  if (!inviteeTarget) return NextResponse.json({ error: 'Enter a creator handle or email.' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Add a stream title.' }, { status: 400 });
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Choose a date and time at least 5 minutes from now.' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const authUsers = await listAuthUsers(adminClient);
  const authById = new Map(authUsers.map((item) => [item.id, item]));
  const invitee = await findProfile(adminClient, authUsers, inviteeTarget);
  if (!invitee) return NextResponse.json({ error: 'Creator not found.' }, { status: 404 });
  if (invitee.id === user.id) return NextResponse.json({ error: 'Invite another creator, not yourself.' }, { status: 400 });

  const { data: inviter, error: inviterError } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,can_stream_live')
    .eq('id', user.id)
    .maybeSingle();
  if (inviterError || !inviter) return NextResponse.json({ error: 'Your profile was not found.' }, { status: 404 });
  if (!inviter.can_stream_live || !invitee.can_stream_live) {
    return NextResponse.json({ error: 'Both creators must be eligible to go live.' }, { status: 403 });
  }

  const { data: invite, error } = await adminClient
    .from('live_collab_invites')
    .insert({
      inviter_id: user.id,
      invitee_id: invitee.id,
      title,
      description,
      scheduled_for: scheduledAt.toISOString(),
      message,
    })
    .select('id,inviter_id,invitee_id,stream_id,title,description,scheduled_for,status,message,created_at,responded_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const inviterName = inviter.username || inviter.handle || 'A ViewTube creator';
  const inviteUrl = '/studio/live';
  const inviteeEmail = authById.get(invitee.id)?.email;
  await sendNotification(adminClient, {
    userId: invitee.id,
    actorId: user.id,
    type: 'live_collab_invite',
    message: `${inviterName} invited you to go live together: ${title}`,
    targetUrl: inviteUrl,
    pushTitle: 'Live together invite',
    pushBody: `${inviterName} invited you to co-host a live stream.`,
  }).catch(() => null);
  if (inviteeEmail) {
    await sendCoLiveInviteEmail({
      to: inviteeEmail,
      inviterName,
      title,
      scheduledFor: scheduledAt.toISOString(),
      inviteUrl,
    }).catch((err) => {
      console.warn('Co-live invite email failed:', err);
    });
  }

  const [withProfiles] = await attachProfiles(adminClient, [invite as InviteRow]);
  return NextResponse.json({ invite: withProfiles });
}
