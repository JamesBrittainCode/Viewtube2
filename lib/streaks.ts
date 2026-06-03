import type { SupabaseClient } from '@supabase/supabase-js';
import { checkContestActivityGate, recordContestActivityEvent } from '@/lib/contest-abuse';

export type ViewtubeActivityType =
  | 'comment'
  | 'comment_like'
  | 'video_like'
  | 'subscribe'
  | 'upload_video'
  | 'go_live'
  | 'ad_watch';

export async function recordViewtubeActivity(
  supabase: SupabaseClient,
  activityType: ViewtubeActivityType,
  opts?: { targetId?: string; pointsOk?: boolean; contentKey?: string | null },
) {
  if (opts?.pointsOk !== false) {
    const gate = await checkContestActivityGate(supabase, activityType, {
      targetId: opts?.targetId ?? null,
      contentKey: opts?.contentKey ?? null,
    });

    if (!gate.allowed) {
      return {
        advanced: false,
        current_streak: 0,
        longest_streak: 0,
        points_total: 0,
        points_delta: 0,
        last_active_date: null,
        champion_user_id: null,
        contest_status: gate.status,
        contest_strikes: gate.strikes,
        contest_paused_until: gate.pausedUntil,
        contest_disqualified_at: gate.disqualifiedAt,
        contest_message: gate.message,
      };
    }

    await recordContestActivityEvent(supabase, activityType, {
      targetId: opts?.targetId ?? null,
      contentKey: opts?.contentKey ?? null,
    });
  }

  // Best-effort: if the database migration hasn't been applied yet, do not break the app.
  const { data, error } = await supabase.rpc('record_viewtube_activity_v2', {
    activity_type: activityType,
    target_id: opts?.targetId ?? null,
    points_ok: opts?.pointsOk ?? true,
  });
  if (error) {
    // Silently ignore. Once the SQL patch is applied, this starts working automatically.
    return null;
  }
  return data as
    | null
    | {
        advanced?: boolean;
        current_streak?: number;
        longest_streak?: number;
        points_total?: number;
        points_delta?: number;
        last_active_date?: string | null;
        champion_user_id?: string | null;
        contest_status?: string;
        contest_strikes?: number;
        contest_paused_until?: string | null;
        contest_disqualified_at?: string | null;
        contest_message?: string;
      };
}
