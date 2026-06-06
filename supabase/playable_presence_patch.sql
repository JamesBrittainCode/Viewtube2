create table if not exists public.playable_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null,
  session_id text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, game_key, session_id)
);

create index if not exists playable_presence_game_last_seen_idx
  on public.playable_presence(game_key, last_seen_at desc);

alter table public.playable_presence enable row level security;

drop policy if exists "Playable presence can be read by signed-in users" on public.playable_presence;
create policy "Playable presence can be read by signed-in users"
  on public.playable_presence
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "Users can create their own playable presence" on public.playable_presence;
create policy "Users can create their own playable presence"
  on public.playable_presence
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own playable presence" on public.playable_presence;
create policy "Users can update their own playable presence"
  on public.playable_presence
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own playable presence" on public.playable_presence;
create policy "Users can delete their own playable presence"
  on public.playable_presence
  for delete
  to authenticated
  using (user_id = auth.uid());

delete from public.playable_presence
where last_seen_at < now() - interval '10 minutes';
