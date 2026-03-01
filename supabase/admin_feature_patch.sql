-- Apply admin profile controls + verified badge support on existing projects.

alter table public.profiles
add column if not exists verified boolean not null default false;

-- Tighten self-update policy so normal users cannot set verified/subscribers_count.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and subscribers_count = (select p.subscribers_count from public.profiles p where p.id = (select auth.uid()))
  and verified = (select p.verified from public.profiles p where p.id = (select auth.uid()))
);

create or replace function public.admin_update_profile_meta(
  target_profile_id uuid,
  target_subscribers_count bigint,
  target_verified boolean
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
    verified = target_verified
  where id = target_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.search_videos(search_query text)
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  thumbnail_url text,
  video_url text,
  tags text[],
  views bigint,
  created_at timestamptz,
  profiles jsonb
)
language sql
stable
set search_path = public
as $$
  select
    v.id,
    v.user_id,
    v.title,
    v.description,
    v.thumbnail_url,
    v.video_url,
    v.tags,
    v.views,
    v.created_at,
    jsonb_build_object(
      'username', p.username,
      'avatar_url', p.avatar_url,
      'verified', p.verified
    ) as profiles
  from public.videos v
  join public.profiles p on p.id = v.user_id
  where v.search_vector @@ websearch_to_tsquery('english', search_query)
     or v.title ilike ('%' || search_query || '%')
     or v.description ilike ('%' || search_query || '%')
  order by ts_rank(v.search_vector, websearch_to_tsquery('english', search_query)) desc, v.created_at desc;
$$;
