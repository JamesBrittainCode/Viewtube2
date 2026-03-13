import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudioVideoEditForm } from '@/components/studio-video-edit-form';

export default async function StudioEditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: video, error } = await supabase
    .from('videos')
    .select('id,user_id,title,description,comments_enabled,thumbnail_url')
    .eq('id', id)
    .maybeSingle();

  if (error || !video) notFound();
  if (video.user_id !== user.id) redirect('/studio/content');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit video</h1>
        <Link
          href={`/watch/${video.id}`}
          className="rounded-full border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
        >
          View video
        </Link>
      </div>

      <StudioVideoEditForm
        videoId={video.id}
        initialTitle={video.title || ''}
        initialDescription={video.description || ''}
        initialCommentsEnabled={video.comments_enabled !== false}
        initialThumbnailUrl={video.thumbnail_url || null}
      />
    </div>
  );
}
