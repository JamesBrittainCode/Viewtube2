import { redirect } from 'next/navigation';
import { VideoGrid } from '@/components/video-grid';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('creator_id')
    .eq('subscriber_id', user.id);

  const creatorIds = (subs || []).map((s) => s.creator_id);

  const { data: videos } = creatorIds.length
      ? await supabase
        .from('videos')
        .select(
          'id,title,thumbnail_url,views,created_at,profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified)'
        )
        .in('user_id', creatorIds)
        .eq('is_removed', false)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">Subscriptions feed</h1>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
