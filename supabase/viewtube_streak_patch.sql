-- ViewTube streaks (daily activity) patch
--
-- Tracks how many consecutive days a user has been active (recorded via a server-side RPC).
-- "Active" should be recorded when the user performs an interaction (comment, like, subscribe,
-- upload, go live, etc.). Only the first interaction per day counts toward streak progression.

create table if not exists public.viewtube_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  updated_at timestamptz not null default now()
);

create index if not exists idx_viewtube_streaks_current on public.viewtube_streaks using btree(current_streak);
create index if not exists idx_viewtube_streaks_last_active on public.viewtube_streaks using btree(last_active_date);

alter table public.viewtube_streaks enable row level security;

drop policy if exists "ViewTube streaks are viewable by everyone" on public.viewtube_streaks;
create policy "ViewTube streaks are viewable by everyone"
on public.viewtube_streaks
for select
using (true);

-- No direct writes (use RPC).
drop policy if exists "Users cannot directly modify viewtube streaks" on public.viewtube_streaks;
create policy "Users cannot directly modify viewtube streaks"
on public.viewtube_streaks
for all
using (false)
with check (false);

create or replace function public.record_viewtube_activity(activity_type text default null)
returns public.viewtube_streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  today_utc date;
  updated public.viewtube_streaks;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Unauthorized';
  end if;

  today_utc := (now() at time zone 'utc')::date;

  insert into public.viewtube_streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
  values (uid, 1, 1, today_utc, now())
  on conflict (user_id) do update
  set
    current_streak = case
      when public.viewtube_streaks.last_active_date = today_utc then public.viewtube_streaks.current_streak
      when public.viewtube_streaks.last_active_date = (today_utc - 1) then public.viewtube_streaks.current_streak + 1
      else 1
    end,
    longest_streak = greatest(
      public.viewtube_streaks.longest_streak,
      case
        when public.viewtube_streaks.last_active_date = today_utc then public.viewtube_streaks.current_streak
        when public.viewtube_streaks.last_active_date = (today_utc - 1) then public.viewtube_streaks.current_streak + 1
        else 1
      end
    ),
    last_active_date = greatest(coalesce(public.viewtube_streaks.last_active_date, date '1970-01-01'), today_utc),
    updated_at = now()
  returning * into updated;

  return updated;
end;
$$;

