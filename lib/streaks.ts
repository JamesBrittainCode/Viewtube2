import type { SupabaseClient } from '@supabase/supabase-js';

export type ViewtubeActivityType =
  | 'comment'
  | 'comment_like'
  | 'video_like'
  | 'subscribe'
  | 'upload_video'
  | 'go_live';

export async function recordViewtubeActivity(
  supabase: SupabaseClient,
  activityType: ViewtubeActivityType,
) {
  // Best-effort: if the database migration hasn't been applied yet, do not break the app.
  const { data, error } = await supabase.rpc('record_viewtube_activity_v2', {
    activity_type: activityType,
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
      };
}
