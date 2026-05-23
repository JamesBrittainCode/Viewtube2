-- ViewTube streaks (daily activity) patch
--
-- Tracks how many consecutive days a user has been active (recorded via a server-side RPC).
-- "Active" should be recorded when the user performs an interaction (comment, like, subscribe,
-- upload, go live, etc.). Only the first interaction per day counts toward streak progression.

create table if not exists public.viewtube_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  points bigint not null default 0 check (points >= 0),
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- If the table already existed (from an earlier migration), ensure new columns are present.
alter table public.viewtube_streaks
add column if not exists points bigint;

update public.viewtube_streaks set points = 0 where points is null;

create index if not exists idx_viewtube_streaks_current on public.viewtube_streaks using btree(current_streak);
create index if not exists idx_viewtube_streaks_last_active on public.viewtube_streaks using btree(last_active_date);

-- Tracks whether a user has already earned points for a specific toggle-able interaction,
-- preventing point farming by like/unlike/like loops.
create table if not exists public.viewtube_activity_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, activity_type, target_id)
);

create index if not exists idx_viewtube_activity_awards_user on public.viewtube_activity_awards using btree(user_id);

alter table public.viewtube_activity_awards enable row level security;

drop policy if exists "ViewTube activity awards are viewable by everyone" on public.viewtube_activity_awards;
create policy "ViewTube activity awards are viewable by everyone"
on public.viewtube_activity_awards
for select
using (true);

drop policy if exists "Users cannot directly modify viewtube activity awards" on public.viewtube_activity_awards;
create policy "Users cannot directly modify viewtube activity awards"
on public.viewtube_activity_awards
for all
using (false)
with check (false);

alter table public.profiles
add column if not exists streak_champion boolean not null default false;

create index if not exists idx_profiles_streak_champion on public.profiles using btree(streak_champion);

-- Backfill champion flag (safe to re-run).
update public.profiles set streak_champion = false where streak_champion = true;
update public.profiles
set streak_champion = true
where id = (
  select s.user_id
  from public.viewtube_streaks s
  order by s.points desc, s.current_streak desc, s.longest_streak desc, s.last_active_date desc nulls last, s.updated_at desc
  limit 1
);

alter table public.viewtube_streaks enable row level security;

drop policy if exists "ViewTube streaks are viewable by everyone" on public.viewtube_streaks;
create policy "ViewTube streaks are viewable by everyone"
on public.viewtube_streaks
for select
using (true);

-- No direct writes (use RPC).
drop policy if exists "Users cannot directly modify viewtube streaks" on public.viewtube_streaks;
create policy "Users cannot directly modify viewtube streaks"
on public.viewtube_streaks
for all
using (false)
with check (false);

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

  select s.user_id
  into champion_after
  from public.viewtube_streaks s
  order by s.points desc, s.current_streak desc, s.longest_streak desc, s.last_active_date desc nulls last, s.updated_at desc
  limit 1;

  if champion_after is not null and champion_before is distinct from champion_after then
    if champion_before is not null then
      update public.profiles set streak_champion = false where id = champion_before;
    end if;
    update public.profiles set streak_champion = true where id = champion_after;
  end if;

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

-- Backwards compatible wrapper (older app versions)
create or replace function public.record_viewtube_activity(activity_type text default null)
returns public.viewtube_streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  uid uuid;
  row public.viewtube_streaks;
begin
  payload := public.record_viewtube_activity_v2(activity_type, null, true);
  uid := auth.uid();
  select * into row from public.viewtube_streaks where user_id = uid;
  return row;
end;
$$;
