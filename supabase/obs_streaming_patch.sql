-- OBS/RTMP live streaming patch (stream keys + ingest metadata)

-- live_streams additions
alter table public.live_streams
add column if not exists source text not null default 'webrtc';

alter table public.live_streams
add column if not exists ingest_stream_name text;

-- stream keys (hashed)
create table if not exists public.live_stream_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  key_hash text not null unique,
  key_last4 text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

-- saved OBS config used on ingest start
create table if not exists public.live_stream_configs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  title text not null default 'Live Stream',
  description text not null default '',
  thumbnail_url text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_streams_source_live on public.live_streams using btree(source, is_live, started_at desc);

alter table public.live_stream_keys enable row level security;
alter table public.live_stream_configs enable row level security;

drop policy if exists "Users can manage own live stream key" on public.live_stream_keys;
create policy "Users can manage own live stream key"
on public.live_stream_keys for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can manage own live stream config" on public.live_stream_configs;
create policy "Users can manage own live stream config"
on public.live_stream_configs for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

