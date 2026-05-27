-- Featured playlists on channel pages
-- Run this in Supabase SQL editor after playlists_patch.sql

create table if not exists public.channel_featured_playlists (
  user_id uuid not null references auth.users (id) on delete cascade,
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, playlist_id)
);

create index if not exists channel_featured_playlists_user_pos
  on public.channel_featured_playlists (user_id, position asc, created_at desc);

alter table public.channel_featured_playlists enable row level security;

drop policy if exists "channel_featured_playlists_select_public_or_owner" on public.channel_featured_playlists;
create policy "channel_featured_playlists_select_public_or_owner"
on public.channel_featured_playlists
for select
using (
  -- owner can always see
  user_id = auth.uid()
  -- or anyone can see if the playlist itself is public
  or exists (
    select 1
    from public.playlists p
    where p.id = channel_featured_playlists.playlist_id
      and p.is_public = true
  )
);

drop policy if exists "channel_featured_playlists_insert_owner" on public.channel_featured_playlists;
create policy "channel_featured_playlists_insert_owner"
on public.channel_featured_playlists
for insert
with check (user_id = auth.uid());

drop policy if exists "channel_featured_playlists_update_owner" on public.channel_featured_playlists;
create policy "channel_featured_playlists_update_owner"
on public.channel_featured_playlists
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "channel_featured_playlists_delete_owner" on public.channel_featured_playlists;
create policy "channel_featured_playlists_delete_owner"
on public.channel_featured_playlists
for delete
using (user_id = auth.uid());

