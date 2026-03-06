-- Live streaming feature patch (WebRTC signaling + chat + eligibility)

alter table public.profiles
add column if not exists can_stream_live boolean not null default false;

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Live Stream',
  description text not null default '',
  is_live boolean not null default true,
  viewer_count integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.live_stream_viewers (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (stream_id, user_id)
);

create table if not exists public.live_signals (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_can_stream_live on public.profiles using btree(can_stream_live);
create index if not exists idx_live_streams_live_started on public.live_streams using btree(is_live, started_at desc);
create index if not exists idx_live_streams_user_live on public.live_streams using btree(user_id, is_live);
create index if not exists idx_live_stream_viewers_stream on public.live_stream_viewers using btree(stream_id);
create index if not exists idx_live_signals_stream_created on public.live_signals using btree(stream_id, created_at asc);
create index if not exists idx_live_signals_recipient on public.live_signals using btree(recipient_id, created_at asc);
create index if not exists idx_live_chat_stream_created on public.live_chat_messages using btree(stream_id, created_at asc);

alter table public.live_streams enable row level security;
alter table public.live_stream_viewers enable row level security;
alter table public.live_signals enable row level security;
alter table public.live_chat_messages enable row level security;

drop policy if exists "Live streams are viewable by everyone" on public.live_streams;
create policy "Live streams are viewable by everyone"
on public.live_streams for select
to anon, authenticated
using (true);

drop policy if exists "Eligible users can create live streams" on public.live_streams;
create policy "Eligible users can create live streams"
on public.live_streams for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.can_stream_live = true
  )
);

drop policy if exists "Stream owners can update own streams" on public.live_streams;
create policy "Stream owners can update own streams"
on public.live_streams for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Live stream viewers are viewable by stream owners" on public.live_stream_viewers;
create policy "Live stream viewers are viewable by stream owners"
on public.live_stream_viewers for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can manage own live stream presence" on public.live_stream_viewers;
create policy "Users can manage own live stream presence"
on public.live_stream_viewers for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Participants can view live signals" on public.live_signals;
create policy "Participants can view live signals"
on public.live_signals for select
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.user_id = (select auth.uid())
  )
);

drop policy if exists "Authenticated users can send live signals" on public.live_signals;
create policy "Authenticated users can send live signals"
on public.live_signals for insert
to authenticated
with check (sender_id = (select auth.uid()));

drop policy if exists "Live chat messages are viewable by everyone" on public.live_chat_messages;
create policy "Live chat messages are viewable by everyone"
on public.live_chat_messages for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can send live chat" on public.live_chat_messages;
create policy "Authenticated users can send live chat"
on public.live_chat_messages for insert
to authenticated
with check (user_id = (select auth.uid()));
