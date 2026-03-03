import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { isAdminEmail } from '@/lib/admin';
import { unwrapRelation } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

type StudioChannel = { username?: string; handle?: string };
type StudioVideo = {
  id?: string;
  title?: string;
  thumbnail_url?: string | null;
  profiles?: StudioChannel | StudioChannel[] | null;
};

export default async function StudioSpotlightPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const isAdmin = isAdminEmail(user.email);
  const nowIso = new Date().toISOString();

  const [currentRes, nextRes] = await Promise.all([
    supabase
      .from('creator_spotlights')
      .select(
        'id,scheduled_for,videos:videos(id,title,thumbnail_url,profiles:profiles!videos_user_id_fkey(username,handle))',
      )
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('creator_spotlights')
      .select(
        'id,scheduled_for,videos:videos(id,title,thumbnail_url,profiles:profiles!videos_user_id_fkey(username,handle))',
      )
      .gt('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const currentVideo = unwrapRelation(
    ((currentRes.data as unknown as { videos?: StudioVideo | StudioVideo[] | null } | null)?.videos ??
      null) as StudioVideo | StudioVideo[] | null,
  );
  const nextVideo = unwrapRelation(
    ((nextRes.data as unknown as { videos?: StudioVideo | StudioVideo[] | null } | null)?.videos ??
      null) as StudioVideo | StudioVideo[] | null,
  );
  const currentChannel = unwrapRelation(currentVideo?.profiles ?? null);
  const nextChannel = unwrapRelation(nextVideo?.profiles ?? null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-4xl font-bold">Creator Spotlight</h1>
      <p className="text-zinc-400">Weekly feature video. New picks publish Monday at 1:00 AM PST.</p>

      <div className={`grid gap-4 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <h4 className="text-sm font-semibold text-zinc-500">Live now</h4>
          {currentRes.data && currentVideo?.id ? (
            <Link href={`/watch/${currentVideo.id}`} className="mt-3 block">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-800">
                <Image
                  src={currentVideo.thumbnail_url || '/thumbnail-placeholder.svg'}
                  alt={currentVideo.title || 'Spotlight'}
                  fill
                  className="object-cover"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold">{currentVideo.title}</p>
              <p className="text-xs text-zinc-500">{currentChannel?.username}</p>
            </Link>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No spotlight video published yet.</p>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <h4 className="text-sm font-semibold text-zinc-500">Next up</h4>
            {nextRes.data && nextVideo?.id ? (
              <Link href={`/watch/${nextVideo.id}`} className="mt-3 block">
                <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-800">
                  <Image
                    src={nextVideo.thumbnail_url || '/thumbnail-placeholder.svg'}
                    alt={nextVideo.title || 'Next spotlight'}
                    fill
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{nextVideo.title}</p>
                <p className="text-xs text-zinc-500">{nextChannel?.username}</p>
                <p className="text-xs text-zinc-500">
                  Publishes: {new Date(nextRes.data.scheduled_for).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT
                </p>
              </Link>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No next spotlight scheduled yet.</p>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <section>
          <AdminProfileManager />
        </section>
      )}
    </div>
  );
}
