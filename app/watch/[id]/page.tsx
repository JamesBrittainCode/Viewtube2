import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { CommentSection } from '@/components/comment-section';
import { DislikeButton } from '@/components/dislike-button';
import { LikeButton } from '@/components/like-button';
import { SubscribeButton } from '@/components/subscribe-button';
import { VideoGrid } from '@/components/video-grid';
import { VideoPlayer } from '@/components/video-player';
import { VerifiedBadge } from '@/components/verified-badge';
import { SetSpotlightButton } from '@/components/set-spotlight-button';
import { isAdminEmail } from '@/lib/admin';
import { getRecommendations, getVideoById } from '@/lib/data';
import { unwrapRelation } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { ReportVideoButton } from '@/components/report-video-button';
import { AdminVideoTakedownButton } from '@/components/admin-video-takedown-button';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return { title: 'Video not found' };

  const description = (video.description || '').trim().slice(0, 160) || 'Watch this video on ViewTube.';
  const image = video.thumbnail_url || '/thumbnail-placeholder.svg';
  const title = video.title || 'ViewTube';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await getVideoById(id);

  if (!video) notFound();

  const recommendations = await getRecommendations(video.id, video.tags || []);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminEmail(user?.email);

  const [{ count: likeCount }, { count: dislikeCount }, likedRes, dislikedRes, subscribedRes, moderationRes] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('video_id', video.id),
    supabase.from('dislikes').select('*', { count: 'exact', head: true }).eq('video_id', video.id),
    user
      ? supabase
          .from('likes')
          .select('id')
          .eq('video_id', video.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('dislikes')
          .select('id')
          .eq('video_id', video.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('subscriptions')
          .select('id')
          .eq('subscriber_id', user.id)
          .eq('creator_id', video.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('profiles')
          .select('can_moderate')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const canModerate = isAdmin || Boolean(moderationRes?.data?.can_moderate);

  const channelProfile = unwrapRelation(video.profiles);
  const channelName = channelProfile?.username || 'unknown';
  const channelHref = channelProfile?.handle ? `/channel/${channelProfile.handle}` : '/';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <VideoPlayer
          id={video.id}
          videoUrl={video.video_url}
        />

        <h1 className="mt-4 text-xl font-bold">{video.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1">
              <Link href={channelHref} className="font-semibold hover:underline">
                {channelName}
              </Link>
              {channelProfile?.verified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-zinc-500">
              {video.views.toLocaleString()} views •{' '}
              {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <LikeButton
              videoId={video.id}
              initiallyLiked={Boolean(likedRes?.data)}
              initialCount={likeCount || 0}
            />
            <DislikeButton
              videoId={video.id}
              initiallyDisliked={Boolean(dislikedRes?.data)}
              initialCount={dislikeCount || 0}
            />
            {user && <ReportVideoButton videoId={video.id} />}
            {isAdmin && <SetSpotlightButton videoId={video.id} />}
            {canModerate && <AdminVideoTakedownButton videoId={video.id} />}
            {user && user.id !== video.user_id && (
              <SubscribeButton
                creatorId={video.user_id}
                initialSubscribed={Boolean(subscribedRes?.data)}
                initialCount={channelProfile?.subscribers_count || 0}
              />
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-900/80">
          <p className="whitespace-pre-wrap">{video.description || 'No description provided.'}</p>
        </div>

        <CommentSection
          videoId={video.id}
          commentsEnabled={video.comments_enabled !== false}
          currentUserId={user?.id || null}
          videoOwnerId={video.user_id}
        />
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recommended</h2>
        <VideoGrid videos={recommendations as never[]} />
      </aside>
    </div>
  );
}
