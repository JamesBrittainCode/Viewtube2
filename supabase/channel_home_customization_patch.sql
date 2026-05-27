-- Channel home customization (home tab sections + featured videos)
-- Run this in Supabase SQL editor after playlists_patch.sql

create table if not exists public.channel_home_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  home_enabled boolean not null default true,
  trailer_video_id uuid references public.videos (id) on delete set null,
  featured_video_id uuid references public.videos (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_home_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  section_type text not null,
  config jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_home_sections_user_pos
  on public.channel_home_sections (user_id, position asc, created_at desc);

alter table public.channel_home_settings enable row level security;
alter table public.channel_home_sections enable row level security;

-- Settings policies
drop policy if exists "channel_home_settings_select_all" on public.channel_home_settings;
create policy "channel_home_settings_select_all"
on public.channel_home_settings
for select
using (true);

drop policy if exists "channel_home_settings_upsert_owner" on public.channel_home_settings;
create policy "channel_home_settings_upsert_owner"
on public.channel_home_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Sections policies
drop policy if exists "channel_home_sections_select_all" on public.channel_home_sections;
create policy "channel_home_sections_select_all"
on public.channel_home_sections
for select
using (true);

drop policy if exists "channel_home_sections_owner_write" on public.channel_home_sections;
create policy "channel_home_sections_owner_write"
on public.channel_home_sections
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

drop trigger if exists channel_home_settings_set_updated_at on public.channel_home_settings;
create trigger channel_home_settings_set_updated_at
before update on public.channel_home_settings
for each row execute function public.set_updated_at();

drop trigger if exists channel_home_sections_set_updated_at on public.channel_home_sections;
create trigger channel_home_sections_set_updated_at
before update on public.channel_home_sections
for each row execute function public.set_updated_at();

