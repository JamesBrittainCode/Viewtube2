-- ViewTube Playables
-- Run this in Supabase SQL editor to enable saved scores and levels.

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
