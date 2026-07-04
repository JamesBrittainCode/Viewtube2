import { createAdminClient } from '@/lib/supabase/admin';

export type FamilyPermission = 'post' | 'comment' | 'messages';

type FamilyLinkRow = {
  allow_post_content?: boolean | null;
  allow_comments?: boolean | null;
  allow_messages?: boolean | null;
};

const permissionColumn: Record<FamilyPermission, keyof FamilyLinkRow> = {
  post: 'allow_post_content',
  comment: 'allow_comments',
  messages: 'allow_messages',
};

const permissionMessage: Record<FamilyPermission, string> = {
  post: 'A linked parent account has turned off posting for this account.',
  comment: 'A linked parent account has turned off commenting for this account.',
  messages: 'A linked parent account has turned off messages for this account.',
};

export async function checkFamilyPermission(userId: string, permission: FamilyPermission) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('family_links')
    .select('allow_post_content,allow_comments,allow_messages')
    .eq('child_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('Family permission check failed', error);
    return { allowed: true, reason: null as string | null };
  }

  const column = permissionColumn[permission];
  const blocked = ((data || []) as FamilyLinkRow[]).some((row) => row[column] === false);
  return {
    allowed: !blocked,
    reason: blocked ? permissionMessage[permission] : null,
  };
}

export async function isChannelBlockedForViewer(viewerId: string | undefined | null, channelId: string) {
  if (!viewerId || viewerId === channelId) return false;

  const adminClient = createAdminClient();
  const { data: links, error: linksError } = await adminClient
    .from('family_links')
    .select('parent_id')
    .eq('child_id', viewerId)
    .eq('status', 'active');

  if (linksError) {
    console.error('Family channel block link check failed', linksError);
    return false;
  }

  const parentIds = Array.from(new Set((links || []).map((link) => link.parent_id).filter(Boolean)));
  if (!parentIds.length) return false;

  const { data, error } = await adminClient
    .from('family_blocked_channels')
    .select('id')
    .eq('child_id', viewerId)
    .eq('blocked_channel_id', channelId)
    .in('parent_id', parentIds)
    .limit(1);

  if (error) {
    console.error('Family channel block check failed', error);
    return false;
  }

  return Boolean(data?.length);
}
