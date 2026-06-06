import type { SupabaseClient } from '@supabase/supabase-js';
import type { ViewtubeActivityType } from '@/lib/streaks';

export type ContestGateResult = {
  allowed: boolean;
  status: 'allowed' | 'paused' | 'strike' | 'disqualified' | 'unavailable';
  strikes: number;
  pausedUntil: string | null;
  disqualifiedAt: string | null;
  message?: string;
};

type ProfileAbuseState = {
  contest_paused_until?: string | null;
};

const RATE_LIMITS: Record<ViewtubeActivityType, { windowSeconds: number; limit: number }> = {
  comment: { windowSeconds: 120, limit: 24 },
  comment_like: { windowSeconds: 60, limit: 45 },
  video_like: { windowSeconds: 60, limit: 40 },
  subscribe: { windowSeconds: 600, limit: 28 },
  upload_video: { windowSeconds: 3600, limit: 20 },
  go_live: { windowSeconds: 3600, limit: 10 },
  ad_watch: { windowSeconds: 86400, limit: 4 },
};

const SAME_TARGET_LIMITS: Partial<Record<ViewtubeActivityType, { windowSeconds: number; limit: number }>> = {
  comment: { windowSeconds: 600, limit: 12 },
  comment_like: { windowSeconds: 600, limit: 16 },
  video_like: { windowSeconds: 86400, limit: 3 },
  subscribe: { windowSeconds: 86400, limit: 3 },
};

function denyPointsOnly(message: string): ContestGateResult {
  return {
    allowed: false,
    status: 'paused',
    strikes: 0,
    pausedUntil: null,
    disqualifiedAt: null,
    message,
  };
}

export async function checkContestActivityGate(
  supabase: SupabaseClient,
  activityType: ViewtubeActivityType,
  opts?: { targetId?: string | null; contentKey?: string | null; forceStrikeReason?: string | null },
): Promise<ContestGateResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, status: 'paused', strikes: 0, pausedUntil: null, disqualifiedAt: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('contest_paused_until')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { allowed: true, status: 'unavailable', strikes: 0, pausedUntil: null, disqualifiedAt: null };
  }

  const state = (profile || {}) as ProfileAbuseState;
  const pausedUntil = state.contest_paused_until || null;
  const pausedUntilMs = pausedUntil ? new Date(pausedUntil).getTime() : 0;
  if (pausedUntilMs && Date.now() < pausedUntilMs) {
    return {
      allowed: false,
      status: 'paused',
      strikes: 0,
      pausedUntil,
      disqualifiedAt: null,
      message: 'Your contest points are temporarily paused.',
    };
  }

  if (opts?.forceStrikeReason) {
    return denyPointsOnly(opts.forceStrikeReason);
  }

  const limit = RATE_LIMITS[activityType];
  const sinceIso = new Date(Date.now() - limit.windowSeconds * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('viewtube_contest_activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('activity_type', activityType)
    .gte('created_at', sinceIso);

  if (countError) {
    return { allowed: true, status: 'unavailable', strikes: 0, pausedUntil: null, disqualifiedAt: null };
  }

  if ((count || 0) >= limit.limit) {
    return denyPointsOnly(`Contest points paused for rapid ${activityType.replaceAll('_', ' ')} activity.`);
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: allRecent } = await supabase
    .from('viewtube_contest_activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', tenMinutesAgo);

  if ((allRecent || 0) >= 100) {
    return denyPointsOnly('Contest points paused for unusually high point activity.');
  }

  if (opts?.contentKey && opts.contentKey.length >= 8 && activityType === 'comment') {
    const { count: repeated } = await supabase
      .from('viewtube_contest_activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('activity_type', 'comment')
      .eq('content_key', opts.contentKey)
      .gte('created_at', tenMinutesAgo);

    if ((repeated || 0) >= 8) {
      return denyPointsOnly('Contest points paused for repetitive comments.');
    }
  }

  const targetLimit = opts?.targetId ? SAME_TARGET_LIMITS[activityType] : null;
  if (targetLimit && opts?.targetId) {
    const targetSinceIso = new Date(Date.now() - targetLimit.windowSeconds * 1000).toISOString();
    const { count: sameTargetCount } = await supabase
      .from('viewtube_contest_activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('activity_type', activityType)
      .eq('target_id', opts.targetId)
      .gte('created_at', targetSinceIso);

    if ((sameTargetCount || 0) >= targetLimit.limit) {
      return denyPointsOnly(
        `Contest points paused for repeatedly farming the same ${activityType.replaceAll('_', ' ')} target.`,
      );
    }
  }

  return { allowed: true, status: 'allowed', strikes: 0, pausedUntil: null, disqualifiedAt: null };
}

export async function recordContestActivityEvent(
  supabase: SupabaseClient,
  activityType: ViewtubeActivityType,
  opts?: { targetId?: string | null; contentKey?: string | null },
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('viewtube_contest_activity_events').insert({
    user_id: user.id,
    activity_type: activityType,
    target_id: opts?.targetId ?? null,
    content_key: opts?.contentKey ?? null,
  });
}

export function normalizeContestText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}
