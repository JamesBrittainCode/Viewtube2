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
  const { error } = await supabase.rpc('record_viewtube_activity', {
    activity_type: activityType,
  });
  if (error) {
    // Silently ignore. Once the SQL patch is applied, this starts working automatically.
  }
}

