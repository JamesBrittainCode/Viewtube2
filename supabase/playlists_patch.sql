-- Playlists + Watch Later (YouTube-like)
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default false,
  is_watch_later boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists playlist_items_unique on public.playlist_items (playlist_id, video_id);
create unique index if not exists playlists_watch_later_unique on public.playlists (user_id) where (is_watch_later = true);

alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;

drop policy if exists "playlists_select_public_or_owner" on public.playlists;
create policy "playlists_select_public_or_owner"
on public.playlists
for select
using (is_public = true or user_id = auth.uid());

drop policy if exists "playlists_insert_owner" on public.playlists;
create policy "playlists_insert_owner"
on public.playlists
for insert
with check (user_id = auth.uid());

drop policy if exists "playlists_update_owner" on public.playlists;
create policy "playlists_update_owner"
on public.playlists
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "playlists_delete_owner" on public.playlists;
create policy "playlists_delete_owner"
on public.playlists
for delete
using (user_id = auth.uid());

drop policy if exists "playlist_items_select_public_or_owner" on public.playlist_items;
create policy "playlist_items_select_public_or_owner"
on public.playlist_items
for select
using (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and (p.is_public = true or p.user_id = auth.uid())
  )
);

drop policy if exists "playlist_items_insert_owner" on public.playlist_items;
create policy "playlist_items_insert_owner"
on public.playlist_items
for insert
with check (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "playlist_items_delete_owner" on public.playlist_items;
create policy "playlist_items_delete_owner"
on public.playlist_items
for delete
using (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_items.playlist_id
      and p.user_id = auth.uid()
  )
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
before update on public.playlists
for each row execute function public.set_updated_at();

