import type { SupabaseClient } from '@supabase/supabase-js';
import { sendNotification } from '@/lib/notifications';
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
  contest_spam_strikes?: number | null;
  contest_disqualified_at?: string | null;
};

const PAUSE_MINUTES = 30;
const MAX_STRIKES = 3;

const RATE_LIMITS: Record<ViewtubeActivityType, { windowSeconds: number; limit: number }> = {
  comment: { windowSeconds: 60, limit: 5 },
  comment_like: { windowSeconds: 60, limit: 16 },
  video_like: { windowSeconds: 60, limit: 14 },
  subscribe: { windowSeconds: 600, limit: 10 },
  upload_video: { windowSeconds: 3600, limit: 8 },
  go_live: { windowSeconds: 3600, limit: 4 },
  ad_watch: { windowSeconds: 86400, limit: 2 },
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function safeMessage(strikes: number, disqualified: boolean) {
  if (disqualified) {
    return 'You received 3 contest abuse strikes and have been removed from the ViewTube contest.';
  }
  return `Your contest points are paused for ${PAUSE_MINUTES} minutes for spammy point activity. Strike ${strikes}/3.`;
}

async function notifyModerators(supabase: SupabaseClient, userId: string, message: string) {
  const { data: mods } = await supabase.from('profiles').select('id').eq('can_moderate', true).limit(50);
  for (const mod of mods || []) {
    if (!mod?.id) continue;
    await sendNotification(supabase, {
      userId: String(mod.id),
      type: 'contest_abuse_report',
      message,
      actorId: userId,
      targetUrl: '/studio/admin',
    });
  }
}

async function addContestStrike(
  supabase: SupabaseClient,
  userId: string,
  currentStrikes: number,
  reason: string,
): Promise<ContestGateResult> {
  const nextStrikes = currentStrikes + 1;
  const now = new Date();
  const disqualified = nextStrikes >= MAX_STRIKES;
  const pausedUntil = disqualified ? null : addMinutes(now, PAUSE_MINUTES).toISOString();
  const disqualifiedAt = disqualified ? now.toISOString() : null;
  const message = safeMessage(nextStrikes, disqualified);

  const update: Record<string, unknown> = {
    contest_spam_strikes: nextStrikes,
    contest_paused_until: pausedUntil,
  };

  if (disqualified) {
    update.contest_disqualified_at = disqualifiedAt;
    update.contest_disqualification_reason = reason;
    update.age_confirmed_16 = false;
    update.streak_champion = false;
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) {
    return { allowed: true, status: 'unavailable', strikes: currentStrikes, pausedUntil: null, disqualifiedAt: null };
  }

  await sendNotification(supabase, {
    userId,
    type: disqualified ? 'contest_disqualified' : 'contest_points_paused',
    message,
    targetUrl: '/streaks',
  });

  if (disqualified || nextStrikes >= 2) {
    await notifyModerators(
      supabase,
      userId,
      disqualified ? 'A user was automatically removed from the ViewTube contest after 3 abuse strikes.' : reason,
    );
  }

  return {
    allowed: false,
    status: disqualified ? 'disqualified' : 'strike',
    strikes: nextStrikes,
    pausedUntil,
    disqualifiedAt,
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
    .select('contest_paused_until,contest_spam_strikes,contest_disqualified_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { allowed: true, status: 'unavailable', strikes: 0, pausedUntil: null, disqualifiedAt: null };
  }

  const state = (profile || {}) as ProfileAbuseState;
  const strikes = Math.max(0, Number(state.contest_spam_strikes || 0));
  const disqualifiedAt = state.contest_disqualified_at || null;
  if (disqualifiedAt) {
    return {
      allowed: false,
      status: 'disqualified',
      strikes,
      pausedUntil: null,
      disqualifiedAt,
      message: 'You are no longer eligible for the ViewTube contest.',
    };
  }

  const pausedUntil = state.contest_paused_until || null;
  const pausedUntilMs = pausedUntil ? new Date(pausedUntil).getTime() : 0;
  if (pausedUntilMs && Date.now() < pausedUntilMs) {
    return {
      allowed: false,
      status: 'paused',
      strikes,
      pausedUntil,
      disqualifiedAt: null,
      message: 'Your contest points are temporarily paused.',
    };
  }

  if (opts?.forceStrikeReason) {
    return addContestStrike(supabase, user.id, strikes, opts.forceStrikeReason);
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
    return { allowed: true, status: 'unavailable', strikes, pausedUntil: null, disqualifiedAt: null };
  }

  if ((count || 0) >= limit.limit) {
    return addContestStrike(
      supabase,
      user.id,
      strikes,
      `Contest points paused for rapid ${activityType.replaceAll('_', ' ')} activity.`,
    );
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: allRecent } = await supabase
    .from('viewtube_contest_activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', tenMinutesAgo);

  if ((allRecent || 0) >= 35) {
    return addContestStrike(supabase, user.id, strikes, 'Contest points paused for unusually high point activity.');
  }

  if (opts?.contentKey && activityType === 'comment') {
    const { count: repeated } = await supabase
      .from('viewtube_contest_activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('activity_type', 'comment')
      .eq('content_key', opts.contentKey)
      .gte('created_at', tenMinutesAgo);

    if ((repeated || 0) >= 2) {
      return addContestStrike(supabase, user.id, strikes, 'Contest points paused for repetitive comments.');
    }
  }

  return { allowed: true, status: 'allowed', strikes, pausedUntil: null, disqualifiedAt: null };
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
