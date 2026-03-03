import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { CommentSection } from '@/components/comment-section';
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

export const runtime = 'edge';

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

  const [{ count: likeCount }, likedRes, subscribedRes] = await Promise.all([
    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('video_id', video.id),
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
          .from('subscriptions')
          .select('id')
          .eq('subscriber_id', user.id)
          .eq('creator_id', video.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const channelProfile = unwrapRelation(video.profiles);
  const channelName = channelProfile?.username || 'unknown';
  const channelHref = channelProfile?.handle ? `/channel/${channelProfile.handle}` : '/';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <VideoPlayer id={video.id} videoUrl={video.video_url} />

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
            {isAdmin && <SetSpotlightButton videoId={video.id} />}
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
        />
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recommended</h2>
        <VideoGrid videos={recommendations as never[]} />
      </aside>
    </div>
  );
}
