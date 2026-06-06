-- Restore Loopd Media to the ViewTube contest leaderboard.
-- Run this in Supabase SQL Editor.

do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower('brittcar001@battlegroundps.org')
  limit 1;

  if target_user_id is null then
    raise exception 'No auth.users row found for brittcar001@battlegroundps.org';
  end if;

  update public.profiles
  set
    age_confirmed_16 = true,
    contest_paused_until = null,
    contest_spam_strikes = 0,
    contest_disqualified_at = null,
    contest_disqualification_reason = null,
    comment_suspended_until = null
  where id = target_user_id;

  insert into public.viewtube_streaks (
    user_id,
    current_streak,
    longest_streak,
    points,
    last_active_date,
    updated_at
  )
  values (
    target_user_id,
    1,
    1,
    2300,
    current_date,
    now()
  )
  on conflict (user_id) do update
  set
    points = greatest(coalesce(public.viewtube_streaks.points, 0), 2300),
    current_streak = greatest(coalesce(public.viewtube_streaks.current_streak, 0), 1),
    longest_streak = greatest(coalesce(public.viewtube_streaks.longest_streak, 0), 1),
    last_active_date = coalesce(public.viewtube_streaks.last_active_date, current_date),
    updated_at = now();

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
end $$;
