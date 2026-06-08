import { redirect } from 'next/navigation';
import { AdminProfileManager } from '@/components/admin-profile-manager';
import { AdminPlayablesManager } from '@/components/admin/playables-manager';
import { AdminPointsAwarder } from '@/components/admin/admin-points-awarder';
import { canModerateUser, isAdminEmail } from '@/lib/admin';
import { VIEWTUBE_CONTEST_END_LABEL, getContestVisibility } from '@/lib/contest';
import { displayHandle } from '@/lib/handle';
import { createClient } from '@/lib/supabase/server';

type ContestRow = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  profiles?: {
    username?: string | null;
    handle?: string | null;
  } | null;
};

export default async function StudioAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');
  const canModerate = await canModerateUser(supabase, { id: user.id, email: user.email });
  if (!canModerate) redirect('/studio');
  const isAdmin = isAdminEmail(user.email);
  const contestVisibility = getContestVisibility(Date.now(), isAdmin);
  const { data: contestRows } = isAdmin
    ? await supabase
        .from('viewtube_streaks')
        .select(
          'user_id,current_streak,longest_streak,points,profiles:profiles!viewtube_streaks_user_id_fkey(username,handle)',
        )
        .order('points', { ascending: false })
        .order('current_streak', { ascending: false })
        .order('longest_streak', { ascending: false })
        .limit(25)
    : { data: null };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-4xl font-bold">{isAdmin ? 'Admin' : 'Moderation'}</h1>
      {isAdmin ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
          <div className="border-b border-zinc-800 bg-gradient-to-r from-fuchsia-700 via-red-700 to-orange-600 px-5 py-4">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Admin-only contest audit</div>
            <h2 className="mt-1 text-2xl font-black text-white">ViewTube contest results</h2>
            <p className="mt-1 text-sm font-semibold text-white/80">
              Ends {VIEWTUBE_CONTEST_END_LABEL}.{' '}
              {contestVisibility.resultsHidden || contestVisibility.inBlackout
                ? 'Public results are currently hidden for the final 30 minutes.'
                : contestVisibility.ended
                  ? 'Contest has ended; verify the winner before awarding the prize.'
                  : 'Public results are still visible.'}
            </p>
          </div>
          <div className="divide-y divide-zinc-800">
            {((contestRows || []) as ContestRow[]).length ? (
              ((contestRows || []) as ContestRow[]).map((row, index) => {
                const profile = row.profiles || {};
                return (
                  <div key={row.user_id} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 px-5 py-3">
                    <div className="text-center text-sm font-black text-zinc-400">#{index + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">
                        {profile.username || displayHandle(profile.handle, 'User')}
                      </div>
                      <div className="truncate text-xs text-zinc-500">{displayHandle(profile.handle)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-white">{row.points.toLocaleString()} pts</div>
                      <div className="text-xs text-zinc-500">
                        {row.current_streak} day streak · best {row.longest_streak}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-6 text-sm text-zinc-400">No contest rows found yet.</div>
            )}
          </div>
        </div>
      ) : null}
      {isAdmin ? <AdminPointsAwarder /> : null}
      {isAdmin ? <AdminPlayablesManager /> : null}
      <AdminProfileManager isAdmin={isAdmin} />
    </div>
  );
}
