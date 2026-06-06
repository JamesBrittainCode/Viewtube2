-- Disable old automatic contest strike/disqualification state.
-- Run this once in Supabase SQL Editor after deploying the no-strikes code.
-- It preserves points and streaks; it only clears old contest-only enforcement flags.

update public.profiles
set
  contest_paused_until = null,
  contest_spam_strikes = 0,
  contest_disqualified_at = null,
  contest_disqualification_reason = null
where
  contest_paused_until is not null
  or coalesce(contest_spam_strikes, 0) <> 0
  or contest_disqualified_at is not null
  or contest_disqualification_reason is not null;

update public.profiles
set streak_champion = false
where streak_champion = true;

update public.profiles
set streak_champion = true
where id = (
  select s.user_id
  from public.viewtube_streaks s
  join public.profiles p on p.id = s.user_id
  order by
    s.points desc,
    s.current_streak desc,
    s.longest_streak desc,
    s.last_active_date desc nulls last,
    s.updated_at desc
  limit 1
);
