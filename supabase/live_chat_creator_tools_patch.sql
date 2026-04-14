-- Live chat creator tools + settings (idempotent).
-- Adds: chat settings on live_streams + pin/delete moderation on live_chat_messages.

-- 1) Stream-level chat settings
alter table public.live_streams
add column if not exists chat_enabled boolean not null default true;

alter table public.live_streams
add column if not exists chat_subscribers_only boolean not null default false;

alter table public.live_streams
add column if not exists chat_slow_mode_seconds integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_streams_chat_slow_mode_nonneg'
  ) then
    alter table public.live_streams
      add constraint live_streams_chat_slow_mode_nonneg
      check (chat_slow_mode_seconds >= 0);
  end if;
end $$;

-- 2) Message-level moderation fields (soft delete + pin)
alter table public.live_chat_messages
add column if not exists pinned boolean not null default false;

alter table public.live_chat_messages
add column if not exists is_deleted boolean not null default false;

alter table public.live_chat_messages
add column if not exists deleted_at timestamptz;

alter table public.live_chat_messages
add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_live_chat_stream_pinned_created
on public.live_chat_messages using btree(stream_id, pinned desc, created_at desc);

-- 3) RLS policies
-- - Inserts only allowed when stream is live + chat enabled.
-- - Creator can pin/delete messages via UPDATE.

alter table public.live_chat_messages enable row level security;

drop policy if exists "Authenticated users can send live chat" on public.live_chat_messages;
create policy "Authenticated users can send live chat"
on public.live_chat_messages for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.is_live = true
      and s.chat_enabled = true
      and (
        s.chat_subscribers_only = false
        or s.user_id = (select auth.uid())
        or exists (
          select 1
          from public.subscriptions sub
          where sub.subscriber_id = (select auth.uid())
            and sub.creator_id = s.user_id
        )
      )
  )
);

drop policy if exists "Stream owners can moderate live chat" on public.live_chat_messages;
create policy "Stream owners can moderate live chat"
on public.live_chat_messages for update
to authenticated
using (
  exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.user_id = (select auth.uid())
  )
);

