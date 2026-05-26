-- Adds ad-watch reward points to the ViewTube streaks RPC (idempotent).
-- Run after `viewtube_streak_patch.sql`.

create or replace function public.record_viewtube_activity_v2(
  activity_type text default null,
  target_id text default null,
  points_ok boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  today_utc date;
  prev_last date;
  prev_current integer;
  updated public.viewtube_streaks;
  advanced boolean;
  champion_before uuid;
  champion_after uuid;
  points_delta bigint;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Unauthorized';
  end if;

  today_utc := (now() at time zone 'utc')::date;

  points_delta := case coalesce(activity_type, '')
    when 'upload_video' then 25
    when 'go_live' then 20
    when 'comment' then 8
    when 'subscribe' then 6
    when 'ad_watch' then 30
    when 'video_like' then 2
    when 'comment_like' then 2
    else 1
  end;

  if points_ok is not true then
    points_delta := 0;
  end if;

  select last_active_date, current_streak
  into prev_last, prev_current
  from public.viewtube_streaks
  where user_id = uid;

  advanced := coalesce(prev_last is distinct from today_utc, true);

  insert into public.viewtube_streaks (user_id, current_streak, longest_streak, points, last_active_date, updated_at)
  values (uid, 1, 1, points_delta, today_utc, now())
  on conflict (user_id) do update
  set
    current_streak = case
      when public.viewtube_streaks.last_active_date = today_utc then public.viewtube_streaks.current_streak
      when public.viewtube_streaks.last_active_date = (today_utc - 1) then public.viewtube_streaks.current_streak + 1
      else 1
    end,
    longest_streak = greatest(
      public.viewtube_streaks.longest_streak,
      case
        when public.viewtube_streaks.last_active_date = today_utc then public.viewtube_streaks.current_streak
        when public.viewtube_streaks.last_active_date = (today_utc - 1) then public.viewtube_streaks.current_streak + 1
        else 1
      end
    ),
    points = public.viewtube_streaks.points + points_delta,
    last_active_date = greatest(coalesce(public.viewtube_streaks.last_active_date, date '1970-01-01'), today_utc),
    updated_at = now()
  returning * into updated;

  select p.id
  into champion_before
  from public.profiles p
  where p.streak_champion = true
  limit 1;

  update public.profiles set streak_champion = false where streak_champion = true;
  update public.profiles
  set streak_champion = true
  where id = (
    select s.user_id
    from public.viewtube_streaks s
    order by s.points desc, s.current_streak desc, s.longest_streak desc, s.last_active_date desc nulls last, s.updated_at desc
    limit 1
  );

  select p.id
  into champion_after
  from public.profiles p
  where p.streak_champion = true
  limit 1;

  return jsonb_build_object(
    'advanced', advanced,
    'current_streak', updated.current_streak,
    'longest_streak', updated.longest_streak,
    'points_total', updated.points,
    'points_delta', points_delta,
    'last_active_date', updated.last_active_date,
    'champion_user_id', champion_after
  );
end;
$$;

