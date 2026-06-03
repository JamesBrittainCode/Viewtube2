-- Contest abuse controls (idempotent).
-- Adds pause/strike/disqualification state for ViewTube streak contest anti-abuse.

alter table public.profiles
  add column if not exists contest_paused_until timestamptz,
  add column if not exists contest_spam_strikes integer not null default 0,
  add column if not exists contest_disqualified_at timestamptz,
  add column if not exists contest_disqualification_reason text;

create index if not exists idx_profiles_contest_paused_until
on public.profiles using btree(contest_paused_until);

create index if not exists idx_profiles_contest_disqualified_at
on public.profiles using btree(contest_disqualified_at);

create table if not exists public.viewtube_contest_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null,
  target_id text,
  content_key text,
  created_at timestamptz not null default now()
);

create index if not exists idx_viewtube_contest_activity_events_user_created
on public.viewtube_contest_activity_events using btree(user_id, created_at desc);

create index if not exists idx_viewtube_contest_activity_events_user_type_created
on public.viewtube_contest_activity_events using btree(user_id, activity_type, created_at desc);

create index if not exists idx_viewtube_contest_activity_events_content
on public.viewtube_contest_activity_events using btree(user_id, activity_type, content_key, created_at desc);

alter table public.viewtube_contest_activity_events enable row level security;

drop policy if exists "Contest activity events are viewable by owner or moderators"
on public.viewtube_contest_activity_events;
create policy "Contest activity events are viewable by owner or moderators"
on public.viewtube_contest_activity_events
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.can_moderate = true
  )
);

drop policy if exists "Users can insert own contest activity events"
on public.viewtube_contest_activity_events;
create policy "Users can insert own contest activity events"
on public.viewtube_contest_activity_events
for insert
with check (user_id = auth.uid());

drop policy if exists "Users cannot update contest activity events"
on public.viewtube_contest_activity_events;
create policy "Users cannot update contest activity events"
on public.viewtube_contest_activity_events
for update
using (false)
with check (false);

drop policy if exists "Users cannot delete contest activity events"
on public.viewtube_contest_activity_events;
create policy "Users cannot delete contest activity events"
on public.viewtube_contest_activity_events
for delete
using (false);
