import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { CommentSection } from '@/components/comment-section';
import { LikeButton } from '@/components/like-button';
import { SubscribeButton } from '@/components/subscribe-button';
import { VideoGrid } from '@/components/video-grid';
import { VideoPlayer } from '@/components/video-player';
import { VerifiedBadge } from '@/components/verified-badge';
import { getRecommendations, getVideoById } from '@/lib/data';
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

  const channelName = video.profiles?.username || 'unknown';

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <VideoPlayer id={video.id} videoUrl={video.video_url} />

        <h1 className="mt-4 text-xl font-bold">{video.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1">
              <Link href={`/channel/${channelName}`} className="font-semibold hover:underline">
                {channelName}
              </Link>
              {video.profiles?.verified && <VerifiedBadge />}
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
            {user && user.id !== video.user_id && (
              <SubscribeButton
                creatorId={video.user_id}
                initialSubscribed={Boolean(subscribedRes?.data)}
                initialCount={video.profiles?.subscribers_count || 0}
              />
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm dark:bg-zinc-900/80">
          <p className="whitespace-pre-wrap">{video.description || 'No description provided.'}</p>
        </div>

        <CommentSection videoId={video.id} />
      </section>

      <aside>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recommended</h2>
        <VideoGrid videos={recommendations as never[]} />
      </aside>
    </div>
  );
}
