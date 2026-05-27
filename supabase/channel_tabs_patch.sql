-- Channel tab visibility settings (Home/Videos/Shorts/Playlists)
-- Run this in Supabase SQL editor after schema.sql

create table if not exists public.channel_tab_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  show_home boolean not null default true,
  show_videos boolean not null default true,
  show_shorts boolean not null default true,
  show_playlists boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.channel_tab_settings enable row level security;

drop policy if exists "channel_tab_settings_select_all" on public.channel_tab_settings;
create policy "channel_tab_settings_select_all"
on public.channel_tab_settings
for select
using (true);

drop policy if exists "channel_tab_settings_owner_write" on public.channel_tab_settings;
create policy "channel_tab_settings_owner_write"
on public.channel_tab_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- updated_at trigger helper (reuse if already created)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists channel_tab_settings_set_updated_at on public.channel_tab_settings;
create trigger channel_tab_settings_set_updated_at
before update on public.channel_tab_settings
for each row execute function public.set_updated_at();

