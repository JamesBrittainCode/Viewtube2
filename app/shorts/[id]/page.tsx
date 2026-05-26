import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { ShortsFeed } from '@/components/shorts-feed';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';

export const runtime = 'edge';

export default async function ShortPermalinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseAuthed = await createClient();
  const {
    data: { user },
  } = await supabaseAuthed.auth.getUser();
  const isAdmin = isAdminEmail(user?.email);
  const moderationRes = user
    ? await supabaseAuthed.from('profiles').select('can_moderate').eq('id', user.id).maybeSingle()
    : { data: null };
  const canModerate = isAdmin || Boolean(moderationRes?.data?.can_moderate);
  const supabase = createPublicClient();

  const { data: current } = await supabase
    .from('videos')
    .select(
      `
        id,
        user_id,
        title,
        video_url,
        comments_enabled,
        is_short,
        created_at,
        profiles:profiles!videos_user_id_fkey ( username, handle )
      `,
    )
    .eq('id', id)
    .eq('is_removed', false)
    .maybeSingle();

  if (!current || !current.is_short) notFound();

  const { data: more } = await supabase
    .from('videos')
    .select(
      `
        id,
        user_id,
        title,
        video_url,
        comments_enabled,
        is_short,
        created_at,
        profiles:profiles!videos_user_id_fkey ( username, handle )
      `,
    )
    .eq('is_removed', false)
    .eq('is_short', true)
    .order('created_at', { ascending: false })
    .limit(30);

  const list = [current, ...(more || []).filter((v) => v.id !== current.id)];

  return (
    <ShortsFeed
      initialShorts={list as never[]}
      currentUserId={user?.id || null}
      canModerate={canModerate}
    />
  );
}
