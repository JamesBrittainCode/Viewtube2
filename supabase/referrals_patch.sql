-- ViewTube referrals patch (idempotent).
-- Awards 50 points to the inviter when a referred user creates an account.

alter table public.profiles
add column if not exists referral_credits bigint not null default 0;

create table if not exists public.viewtube_referrals (
  invitee_id uuid primary key references auth.users(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_viewtube_referrals_inviter on public.viewtube_referrals using btree(inviter_id);

-- Helper: award points to an arbitrary user (not auth.uid()).
create or replace function public.award_viewtube_points(
  target_user_id uuid,
  activity_type text,
  target_id text default null,
  points_delta bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_utc date;
  prev_last date;
  updated public.viewtube_streaks;
  advanced boolean;
  champion_before uuid;
  champion_after uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;
  if points_delta is null or points_delta < 0 then
    raise exception 'points_delta must be >= 0';
  end if;

  today_utc := (now() at time zone 'utc')::date;

  select last_active_date
  into prev_last
  from public.viewtube_streaks
  where user_id = target_user_id;

  advanced := coalesce(prev_last is distinct from today_utc, true);

  insert into public.viewtube_streaks (user_id, current_streak, longest_streak, points, last_active_date, updated_at)
  values (target_user_id, 1, 1, points_delta, today_utc, now())
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
    points = public.viewtube_streaks.points + points_delta,
    last_active_date = greatest(coalesce(public.viewtube_streaks.last_active_date, date '1970-01-01'), today_utc),
    updated_at = now()
  returning * into updated;

  select p.id
  into champion_before
  from public.profiles p
  where p.streak_champion = true
  limit 1;

  update public.profiles set streak_champion = false where streak_champion = true;
  update public.profiles
  set streak_champion = true
  where id = (
    select s.user_id
    from public.viewtube_streaks s
    order by s.points desc, s.current_streak desc, s.longest_streak desc, s.last_active_date desc nulls last, s.updated_at desc
    limit 1
  );

  select p.id
  into champion_after
  from public.profiles p
  where p.streak_champion = true
  limit 1;

  return jsonb_build_object(
    'advanced', advanced,
    'current_streak', updated.current_streak,
    'longest_streak', updated.longest_streak,
    'points_total', updated.points,
    'points_delta', points_delta,
    'last_active_date', updated.last_active_date,
    'champion_user_id', champion_after
  );
end;
$$;

-- Trigger: when a new auth user is created, if they have referral metadata, credit inviter.
create or replace function public.handle_referral_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_code text;
  code text;
  inviter uuid;
  points_ok boolean;
begin
  raw_code := coalesce(new.raw_user_meta_data ->> 'referral', '');
  code := btrim(raw_code);
  if code = '' then
    return new;
  end if;

  -- Normalize: allow either "@handle" or "handle".
  if left(code, 1) <> '@' then
    code := '@' || code;
  end if;

  select p.id into inviter from public.profiles p where p.handle = code limit 1;
  if inviter is null then
    return new;
  end if;
  if inviter = new.id then
    return new;
  end if;

  -- Record referral once per invitee.
  insert into public.viewtube_referrals (invitee_id, inviter_id, referral_code)
  values (new.id, inviter, code)
  on conflict (invitee_id) do nothing;

  -- Award points once per invitee to prevent abuse.
  begin
    insert into public.viewtube_activity_awards (user_id, activity_type, target_id)
    values (inviter, 'referral', new.id::text);
    points_ok := true;
  exception when others then
    points_ok := false;
  end;

  if points_ok then
    perform public.award_viewtube_points(inviter, 'referral', new.id::text, 50);
    update public.profiles set referral_credits = referral_credits + 1 where id = inviter;
    insert into public.notifications (user_id, actor_id, type, message, target_url)
    values (
      inviter,
      null,
      'referral_signup',
      'Someone signed up using your referral link. +50 points!',
      '/streaks'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_referral on auth.users;
create trigger on_auth_user_created_referral
after insert on auth.users
for each row execute function public.handle_referral_on_auth_user_created();
