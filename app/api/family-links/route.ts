import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type ProfileSummary = {
  id: string;
  username: string | null;
  handle: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  is_admin?: boolean | null;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 9;
const CODE_TTL_MINUTES = 15;

function makeCode() {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes)
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join('');
}

function expiresAt() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

async function createUniqueCode(adminClient: ReturnType<typeof createAdminClient>) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeCode();
    const { data } = await adminClient
      .from('family_link_codes')
      .select('child_id')
      .eq('code', code)
      .maybeSingle();
    if (!data) return code;
  }
  return makeCode();
}

async function getProfiles(adminClient: ReturnType<typeof createAdminClient>, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map<string, ProfileSummary>();
  const { data } = await adminClient
    .from('profiles')
    .select('id,username,handle,avatar_url,verified,is_admin')
    .in('id', unique);
  return new Map((data || []).map((profile) => [profile.id, profile as ProfileSummary]));
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  const nowIso = new Date().toISOString();
  await adminClient.from('family_link_codes').delete().lt('expires_at', nowIso);

  const [codeRes, parentLinksRes, childLinksRes] = await Promise.all([
    adminClient
      .from('family_link_codes')
      .select('code,expires_at,created_at')
      .eq('child_id', user.id)
      .gt('expires_at', nowIso)
      .maybeSingle(),
    adminClient
      .from('family_links')
      .select('id,parent_id,child_id,status,allow_post_content,allow_comments,allow_messages,created_at,updated_at')
      .eq('parent_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    adminClient
      .from('family_links')
      .select('id,parent_id,child_id,status,allow_post_content,allow_comments,allow_messages,created_at,updated_at')
      .eq('child_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ]);

  if (parentLinksRes.error) return NextResponse.json({ error: parentLinksRes.error.message }, { status: 400 });
  if (childLinksRes.error) return NextResponse.json({ error: childLinksRes.error.message }, { status: 400 });

  const parentLinks = parentLinksRes.data || [];
  const childLinks = childLinksRes.data || [];
  const profileIds = [
    ...parentLinks.map((link) => link.child_id),
    ...childLinks.map((link) => link.parent_id),
  ];
  const profileById = await getProfiles(adminClient, profileIds);

  const childIds = parentLinks.map((link) => link.child_id);
  const { data: blockedRows } = childIds.length
    ? await adminClient
        .from('family_blocked_channels')
        .select('id,parent_id,child_id,blocked_channel_id,created_at')
        .eq('parent_id', user.id)
        .in('child_id', childIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const blockedProfileById = await getProfiles(
    adminClient,
    (blockedRows || []).map((row) => row.blocked_channel_id),
  );
  const blockedByChild = new Map<string, unknown[]>();
  for (const row of blockedRows || []) {
    const next = blockedByChild.get(row.child_id) || [];
    next.push({
      ...row,
      channel: blockedProfileById.get(row.blocked_channel_id) || null,
    });
    blockedByChild.set(row.child_id, next);
  }

  return NextResponse.json({
    code: codeRes.data || null,
    children: parentLinks.map((link) => ({
      ...link,
      child: profileById.get(link.child_id) || null,
      blockedChannels: blockedByChild.get(link.child_id) || [],
    })),
    parents: childLinks.map((link) => ({
      ...link,
      parent: profileById.get(link.parent_id) || null,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    code?: string;
    childId?: string;
    linkId?: string;
    allowPostContent?: boolean;
    allowComments?: boolean;
    allowMessages?: boolean;
    channelId?: string;
  };
  const action = String(body.action || '');
  const adminClient = createAdminClient();

  if (action === 'generateCode') {
    const code = await createUniqueCode(adminClient);
    const expiry = expiresAt();
    const { data, error } = await adminClient
      .from('family_link_codes')
      .upsert({ child_id: user.id, code, expires_at: expiry }, { onConflict: 'child_id' })
      .select('code,expires_at,created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ code: data });
  }

  if (action === 'linkWithCode') {
    const code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return NextResponse.json({ error: 'Enter the one-time key first.' }, { status: 400 });

    const { data: linkCode, error } = await adminClient
      .from('family_link_codes')
      .select('child_id,code,expires_at')
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!linkCode) return NextResponse.json({ error: 'That key is invalid or expired.' }, { status: 404 });
    if (linkCode.child_id === user.id) {
      return NextResponse.json({ error: 'You cannot link your own account as a parent.' }, { status: 400 });
    }

    const { data: link, error: linkError } = await adminClient
      .from('family_links')
      .upsert(
        {
          parent_id: user.id,
          child_id: linkCode.child_id,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'parent_id,child_id' },
      )
      .select('id,parent_id,child_id,status,allow_post_content,allow_comments,allow_messages')
      .single();
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });

    await adminClient.from('family_link_codes').delete().eq('child_id', linkCode.child_id);
    await sendNotification(supabase, {
      userId: linkCode.child_id,
      type: 'family_linked',
      message: 'A parent account has linked to your ViewTube account.',
      actorId: user.id,
      targetUrl: '/studio/settings/linked-accounts',
    });

    return NextResponse.json({ link });
  }

  if (action === 'updateControls') {
    const linkId = String(body.linkId || '');
    const updates = {
      allow_post_content: body.allowPostContent !== false,
      allow_comments: body.allowComments !== false,
      allow_messages: body.allowMessages !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await adminClient
      .from('family_links')
      .update(updates)
      .eq('id', linkId)
      .eq('parent_id', user.id)
      .select('id,parent_id,child_id,status,allow_post_content,allow_comments,allow_messages,updated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ link: data });
  }

  if (action === 'unlink') {
    const linkId = String(body.linkId || '');
    const { error } = await adminClient
      .from('family_links')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', linkId)
      .or(`parent_id.eq.${user.id},child_id.eq.${user.id}`);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'blockChannel') {
    const childId = String(body.childId || '');
    const channelId = String(body.channelId || '');
    if (!childId || !channelId) return NextResponse.json({ error: 'Choose a child and channel first.' }, { status: 400 });

    const { data: link } = await adminClient
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', childId)
      .eq('status', 'active')
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Linked child account not found.' }, { status: 404 });
    if (channelId === childId) return NextResponse.json({ error: 'You cannot block the child’s own channel.' }, { status: 400 });

    const { error } = await adminClient
      .from('family_blocked_channels')
      .upsert({ parent_id: user.id, child_id: childId, blocked_channel_id: channelId }, { onConflict: 'parent_id,child_id,blocked_channel_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'unblockChannel') {
    const blockId = String(body.channelId || body.linkId || '');
    const { error } = await adminClient
      .from('family_blocked_channels')
      .delete()
      .eq('id', blockId)
      .eq('parent_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}
