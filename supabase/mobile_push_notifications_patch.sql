-- Mobile app push notifications + per-user notification preferences.
-- Run this in Supabase SQL Editor before enabling iOS push in production.

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null default 'ios' check (platform in ('ios', 'android', 'web')),
  device_name text,
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  new_subscriber_push boolean not null default true,
  new_comment_push boolean not null default true,
  messages_push boolean not null default true,
  message_requests_push boolean not null default true,
  admin_messages_push boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_mobile_push_tokens_user_enabled
on public.mobile_push_tokens using btree(user_id, enabled);

alter table public.mobile_push_tokens enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "Users can view own mobile push tokens" on public.mobile_push_tokens;
create policy "Users can view own mobile push tokens"
on public.mobile_push_tokens for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own mobile push tokens" on public.mobile_push_tokens;
create policy "Users can insert own mobile push tokens"
on public.mobile_push_tokens for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own mobile push tokens" on public.mobile_push_tokens;
create policy "Users can update own mobile push tokens"
on public.mobile_push_tokens for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own mobile push tokens" on public.mobile_push_tokens;
create policy "Users can delete own mobile push tokens"
on public.mobile_push_tokens for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own notification preferences" on public.notification_preferences;
create policy "Users can view own notification preferences"
on public.notification_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
on public.notification_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
on public.notification_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
before update on public.notification_preferences
for each row execute function public.touch_notification_preferences_updated_at();
