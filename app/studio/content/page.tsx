import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatCompactCount } from '@/lib/number';

export default async function StudioContentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: videos } = await supabase
    .from('videos')
    .select('id,title,views,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Content</h1>
        <Link href="/upload" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900">Upload video</Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Views</th>
              <th className="px-4 py-3 text-left">Published</th>
            </tr>
          </thead>
          <tbody>
            {(videos || []).map((video) => (
              <tr key={video.id} className="border-t border-zinc-800">
                <td className="px-4 py-3">
                  <Link href={`/watch/${video.id}`} className="hover:underline">{video.title}</Link>
                </td>
                <td className="px-4 py-3">{formatCompactCount(video.views || 0)}</td>
                <td className="px-4 py-3">{new Date(video.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!(videos || []).length && (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={3}>No videos yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
