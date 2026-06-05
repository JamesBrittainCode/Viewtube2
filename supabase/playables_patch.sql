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
