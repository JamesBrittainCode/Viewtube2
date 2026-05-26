import { getShortsVideos } from '@/lib/data';
import { ShortsFeed } from '@/components/shorts-feed';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';

export const runtime = 'edge';

export default async function ShortsPage() {
  const { videos } = await getShortsVideos(1);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = isAdminEmail(user?.email);
  const moderationRes = user
    ? await supabase.from('profiles').select('can_moderate').eq('id', user.id).maybeSingle()
    : { data: null };
  const canModerate = isAdmin || Boolean(moderationRes?.data?.can_moderate);

  return (
    <ShortsFeed
      initialShorts={videos as never[]}
      currentUserId={user?.id || null}
      canModerate={canModerate}
    />
  );
}
