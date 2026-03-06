import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { SubscribeButton } from '@/components/subscribe-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { VideoGrid } from '@/components/video-grid';
import { formatCompactCount } from '@/lib/number';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const channelKey = decodeURIComponent(username);
  const publicClient = createPublicClient();

  let { data: channel, error } = await publicClient
    .from('profiles')
    .select('*')
    .eq('handle', channelKey)
    .single();

  if (error || !channel) {
    const fallback = await publicClient
      .from('profiles')
      .select('*')
      .eq('username', channelKey)
      .single();
    channel = fallback.data;
    error = fallback.error;
  }

  if (error || !channel) notFound();
  if (channel.handle !== channelKey) {
    redirect(`/channel/${channel.handle}`);
  }

  const { data: videos } = await publicClient
    .from('videos')
    .select(
      'id,title,thumbnail_url,views,created_at,profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified)'
    )
    .eq('user_id', channel.id)
    .eq('is_removed', false)
    .order('created_at', { ascending: false });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscribed = false;

  if (user) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('creator_id', channel.id)
      .maybeSingle();
    subscribed = Boolean(data);
  }

  return (
    <section>
      <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
        {channel.banner_url && (
          <Image src={channel.banner_url} alt={channel.username} fill className="object-cover" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Image
            src={channel.avatar_url || '/avatar-placeholder.svg'}
            alt={channel.username}
            width={84}
            height={84}
            className="h-20 w-20 rounded-full object-cover"
          />
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-bold">{channel.username}</h1>
              {channel.verified && <VerifiedBadge className="h-5 w-5" />}
            </div>
            <p className="text-sm text-zinc-500">
              {formatCompactCount(channel.subscribers_count)} subscribers
            </p>
            {channel.bio && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{channel.bio}</p>}
          </div>
        </div>

        {user && user.id !== channel.id && (
          <SubscribeButton
            creatorId={channel.id}
            initialSubscribed={subscribed}
            initialCount={channel.subscribers_count}
          />
        )}
      </div>

      <h2 className="mb-5 mt-8 text-lg font-semibold">Videos</h2>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
