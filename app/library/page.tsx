import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VideoGrid } from '@/components/video-grid';
import { createClient } from '@/lib/supabase/server';

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: videos } = await supabase
    .from('videos')
    .select(
      'id,title,thumbnail_url,views,created_at,profiles:profiles!videos_user_id_fkey(username,handle,avatar_url,verified)'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your library</h1>
        <Link
          href="/upload"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Upload new video
        </Link>
      </div>
      <VideoGrid videos={(videos || []) as never[]} />
    </section>
  );
}
