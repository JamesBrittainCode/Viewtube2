import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: profile }, { data: videos }] = await Promise.all([
    supabase.from('profiles').select('username,handle,subscribers_count').eq('id', user.id).maybeSingle(),
    supabase
      .from('videos')
      .select('id,title,thumbnail_url,views,created_at,is_short,visibility')
      .eq('user_id', user.id)
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const videoList = videos || [];
  const videoIds = videoList.map((video) => video.id);
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [{ count: commentCount }, { count: likeCount }, { count: recentCommentCount }, recentCommentsRes] =
    videoIds.length
      ? await Promise.all([
          supabase.from('comments').select('id', { count: 'exact', head: true }).in('video_id', videoIds),
          supabase.from('likes').select('id', { count: 'exact', head: true }).in('video_id', videoIds),
          supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .in('video_id', videoIds)
            .gte('created_at', since),
          supabase
            .from('comments')
            .select('id,content,created_at,video_id,profiles:user_id(username,handle,avatar_url)')
            .in('video_id', videoIds)
            .order('created_at', { ascending: false })
            .limit(6),
        ])
      : [
          { count: 0 },
          { count: 0 },
          { count: 0 },
          { data: [] },
        ];

  const totalViews = videoList.reduce((sum, video) => sum + Number(video.views || 0), 0);
  const recentViews = videoList
    .filter((video) => new Date(video.created_at).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, video) => sum + Number(video.views || 0), 0);
  const topVideos = [...videoList]
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
    .slice(0, 5);

  return NextResponse.json({
    profile: profile || null,
    metrics: {
      subscribers: Number(profile?.subscribers_count || 0),
      videos: videoList.length,
      shorts: videoList.filter((video) => video.is_short).length,
      publicVideos: videoList.filter((video) => video.visibility === 'public').length,
      totalViews,
      recentViews,
      comments: Number(commentCount || 0),
      recentComments: Number(recentCommentCount || 0),
      likes: Number(likeCount || 0),
    },
    topVideos,
    recentComments: recentCommentsRes.data || [],
    updatedAt: new Date().toISOString(),
  });
}
