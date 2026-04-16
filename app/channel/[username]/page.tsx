import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { SubscribeButton } from '@/components/subscribe-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { VideoGrid } from '@/components/video-grid';
import { formatCompactCount } from '@/lib/number';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const channelKey = decodeURIComponent(username);
  const publicClient = createPublicClient();

  let { data: channel } = await publicClient.from('profiles').select('*').eq('handle', channelKey).maybeSingle();
  if (!channel) {
    const fallback = await publicClient.from('profiles').select('*').eq('username', channelKey).maybeSingle();
    channel = fallback.data;
  }
  if (!channel) return { title: 'Channel not found' };

  const title = `${channel.username} (${channel.handle})`;
  const description =
    (channel.bio || '').trim() ||
    `Watch videos from ${channel.username} on ViewTube.`;
  const image = channel.avatar_url || '/avatar-placeholder.svg';

  return {
    title,
    description,
    alternates: {
      canonical: `/channel/${channel.handle}`,
    },
    openGraph: {
      title,
      description,
      images: [image],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

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

  const { data: liveStream } = await publicClient
    .from('live_streams')
    .select('id,title,description,thumbnail_url,viewer_count,started_at,is_live')
    .eq('user_id', channel.id)
    .eq('is_live', true)
    .order('started_at', { ascending: false })
    .maybeSingle();

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: channel.username,
            identifier: channel.handle,
            image: channel.avatar_url || undefined,
            description: channel.bio || undefined,
            url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/channel/${channel.handle}`,
          }),
        }}
      />
      <div className="relative h-44 overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
        {channel.banner_url && (
          <Image src={channel.banner_url} alt={channel.username} fill className="object-cover" />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={[
              'relative h-20 w-20 rounded-full',
              liveStream?.id
                ? 'ring-4 ring-red-500 ring-offset-4 ring-offset-white dark:ring-offset-zinc-950'
                : '',
            ].join(' ')}
          >
            <Image
              src={channel.avatar_url || '/avatar-placeholder.svg'}
              alt={channel.username}
              width={84}
              height={84}
              className="h-20 w-20 rounded-full object-cover"
            />
            {liveStream?.id ? (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                LIVE
              </span>
            ) : null}
          </div>
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

      {liveStream?.id ? (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Live now</h2>
          <Link
            href={`/live/${liveStream.id}`}
            className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-800">
              <Image
                src={liveStream.thumbnail_url || channel.banner_url || '/thumbnail-placeholder.svg'}
                alt={liveStream.title || 'Live stream'}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 900px"
                priority
              />
              <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                LIVE
              </span>
              <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                {Number(liveStream.viewer_count || 0).toLocaleString()} watching
              </span>
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 text-base font-semibold group-hover:underline">
                {liveStream.title || 'Live Stream'}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Started {formatDistanceToNow(new Date(liveStream.started_at), { addSuffix: true })}
              </p>
              {liveStream.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {liveStream.description}
                </p>
              ) : null}
            </div>
          </Link>
        </div>
      ) : null}

      <h2 className="mb-5 mt-8 text-lg font-semibold">Videos</h2>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
