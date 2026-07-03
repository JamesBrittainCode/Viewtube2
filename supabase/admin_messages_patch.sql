alter table public.profiles
add column if not exists is_admin boolean not null default false;

update public.profiles
set is_admin = true
where id in (
  select id from auth.users where lower(email) = 'jesuslearningclub@gmail.com'
);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and subscribers_count = (select p.subscribers_count from public.profiles p where p.id = (select auth.uid()))
  and verified = (select p.verified from public.profiles p where p.id = (select auth.uid()))
  and top_streamer = (select p.top_streamer from public.profiles p where p.id = (select auth.uid()))
  and is_admin = (select p.is_admin from public.profiles p where p.id = (select auth.uid()))
  and suspended = (select p.suspended from public.profiles p where p.id = (select auth.uid()))
  and suspension_reason is not distinct from (select p.suspension_reason from public.profiles p where p.id = (select auth.uid()))
  and suspended_at is not distinct from (select p.suspended_at from public.profiles p where p.id = (select auth.uid()))
  and can_stream_live = (select p.can_stream_live from public.profiles p where p.id = (select auth.uid()))
  and can_moderate = (select p.can_moderate from public.profiles p where p.id = (select auth.uid()))
  and moderation_strikes = (select p.moderation_strikes from public.profiles p where p.id = (select auth.uid()))
);

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_admin_thread boolean not null default false,
  is_broadcast boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_thread_participants (
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending','accepted','blocked')),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.message_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  is_admin_message boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_thread_participants_user_id
on public.message_thread_participants using btree(user_id, created_at desc);

create index if not exists idx_message_thread_messages_thread_id
on public.message_thread_messages using btree(thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.message_thread_participants enable row level security;
alter table public.message_thread_messages enable row level security;

drop policy if exists "Users can read their message threads" on public.message_threads;
create policy "Users can read their message threads"
on public.message_threads for select
using (
  exists (
    select 1 from public.message_thread_participants p
    where p.thread_id = id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own message participants" on public.message_thread_participants;
create policy "Users can read own message participants"
on public.message_thread_participants for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.message_thread_participants mine
    where mine.thread_id = message_thread_participants.thread_id
      and mine.user_id = auth.uid()
  )
);

drop policy if exists "Users can read messages in their threads" on public.message_thread_messages;
create policy "Users can read messages in their threads"
on public.message_thread_messages for select
using (
  exists (
    select 1 from public.message_thread_participants p
    where p.thread_id = thread_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert messages in accepted threads" on public.message_thread_messages;
create policy "Users can insert messages in accepted threads"
on public.message_thread_messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.message_thread_participants p
    where p.thread_id = thread_id and p.user_id = auth.uid() and p.status = 'accepted'
  )
);

drop policy if exists "Users can update their message participant state" on public.message_thread_participants;
create policy "Users can update their message participant state"
on public.message_thread_participants for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
