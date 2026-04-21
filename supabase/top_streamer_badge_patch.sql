-- Top ViewTube Streamer badge patch

alter table public.profiles
add column if not exists top_streamer boolean not null default false;

-- Ensure users cannot self-award by profile update RLS (enforced in schema.sql policy).

-- Update admin RPC (new arg)
create or replace function public.admin_update_profile_meta(
  target_profile_id uuid,
  target_subscribers_count bigint,
  target_verified boolean,
  target_suspended boolean,
  target_top_streamer boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  updated_profile public.profiles;
begin
  current_email := coalesce(auth.jwt() ->> 'email', '');

  if current_email <> 'jesuslearningclub@gmail.com' then
    raise exception 'Unauthorized';
  end if;

  update public.profiles
  set
    subscribers_count = greatest(0, target_subscribers_count),
    verified = target_verified,
    top_streamer = target_top_streamer,
    suspended = target_suspended,
    suspension_reason = case
      when target_suspended then coalesce(suspension_reason, 'Suspended by admin')
      else null
    end,
    suspended_at = case
      when target_suspended and suspended = false then now()
      when target_suspended then suspended_at
      else null
    end
  where id = target_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

-- Backwards compatible wrapper (older app versions)
create or replace function public.admin_update_profile_meta(
  target_profile_id uuid,
  target_subscribers_count bigint,
  target_verified boolean,
  target_suspended boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_top boolean;
begin
  select top_streamer into current_top from public.profiles where id = target_profile_id;
  return public.admin_update_profile_meta(target_profile_id, target_subscribers_count, target_verified, target_suspended, coalesce(current_top, false));
end;
$$;

