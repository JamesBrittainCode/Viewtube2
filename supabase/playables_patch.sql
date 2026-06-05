-- ViewTube Playables
-- Run this in Supabase SQL editor to enable uploaded HTML games plus saved scores and levels.

create table if not exists public.playable_games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  description text not null default '',
  category text not null default 'Arcade',
  thumbnail_url text,
  game_url text not null,
  instructions text not null default '',
  is_active boolean not null default true,
  plays_count bigint not null default 0 check (plays_count >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_playable_games_active
  on public.playable_games using btree(is_active, created_at desc);

alter table public.playable_games enable row level security;

drop policy if exists "playable_games_select_active" on public.playable_games;
create policy "playable_games_select_active"
on public.playable_games
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "playable_games_admin_all" on public.playable_games;
create policy "playable_games_admin_all"
on public.playable_games
for all
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create table if not exists public.playable_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null,
  high_score integer not null default 0 check (high_score >= 0),
  level integer not null default 1 check (level >= 1),
  plays integer not null default 0 check (plays >= 0),
  last_score integer not null default 0 check (last_score >= 0),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_key)
);

create index if not exists idx_playable_scores_user
  on public.playable_scores using btree(user_id, updated_at desc);

alter table public.playable_scores enable row level security;

drop policy if exists "playable_scores_select_owner" on public.playable_scores;
create policy "playable_scores_select_owner"
on public.playable_scores
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "playable_scores_insert_owner" on public.playable_scores;
create policy "playable_scores_insert_owner"
on public.playable_scores
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "playable_scores_update_owner" on public.playable_scores;
create policy "playable_scores_update_owner"
on public.playable_scores
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_playable_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists playable_scores_set_updated_at on public.playable_scores;
create trigger playable_scores_set_updated_at
before update on public.playable_scores
for each row execute function public.set_playable_scores_updated_at();

drop trigger if exists playable_games_set_updated_at on public.playable_games;
create trigger playable_games_set_updated_at
before update on public.playable_games
for each row execute function public.set_playable_scores_updated_at();

insert into storage.buckets (id, name, public)
values ('playables', 'playables', true)
on conflict (id) do nothing;

drop policy if exists "Public read access for playables bucket" on storage.objects;
create policy "Public read access for playables bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'playables');

drop policy if exists "Only admin uploads playables bucket objects" on storage.objects;
create policy "Only admin uploads playables bucket objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'playables'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

drop policy if exists "Only admin updates playables bucket objects" on storage.objects;
create policy "Only admin updates playables bucket objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'playables'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
)
with check (
  bucket_id = 'playables'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

insert into public.playable_games (
  title,
  slug,
  description,
  category,
  thumbnail_url,
  game_url,
  instructions,
  is_active
)
values (
  'Flappy Dunk',
  'flappy-dunk',
  'Guide the winged basketball through hoops and keep your streak alive.',
  'Sports',
  '/playables/flappy-dunk/thumbnail.png',
  '/playables/flappy-dunk/index.html',
  'Tap or click to flap. Time your jumps to dunk through each hoop.',
  true
)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  thumbnail_url = excluded.thumbnail_url,
  game_url = excluded.game_url,
  instructions = excluded.instructions,
  is_active = true;

create or replace function public.record_flappy_dunk_points(score_value integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  today_utc date;
  hour_target text;
  inserted_count integer;
  prev_last date;
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

  points_delta := greatest(0, floor(coalesce(score_value, 0)))::bigint;
  if points_delta <= 0 then
    return jsonb_build_object('points_delta', 0, 'contest_status', 'no_score');
  end if;

  today_utc := (now() at time zone 'utc')::date;
  hour_target := 'flappy-dunk:' || to_char(date_trunc('hour', now() at time zone 'utc'), 'YYYYMMDDHH24');

  insert into public.viewtube_activity_awards (user_id, activity_type, target_id)
  values (uid, 'flappy_dunk', hour_target)
  on conflict (user_id, activity_type, target_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    select * into updated from public.viewtube_streaks where user_id = uid;
    return jsonb_build_object(
      'points_delta', 0,
      'points_total', coalesce(updated.points, 0),
      'current_streak', coalesce(updated.current_streak, 0),
      'longest_streak', coalesce(updated.longest_streak, 0),
      'contest_status', 'cooldown',
      'message', 'Flappy Dunk streak points can be earned once per hour.'
    );
  end if;

  select last_active_date into prev_last from public.viewtube_streaks where user_id = uid;
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

  select p.id into champion_before from public.profiles p where p.streak_champion = true limit 1;

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
    'champion_user_id', champion_after,
    'contest_status', 'awarded'
  );
end;
$$;
