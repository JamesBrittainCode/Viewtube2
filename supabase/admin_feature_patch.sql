-- Apply admin profile controls + verified badge support on existing projects.

alter table public.profiles
add column if not exists verified boolean not null default false;
alter table public.profiles
add column if not exists handle text;

create or replace function public.normalize_handle(input_text text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := regexp_replace(lower(coalesce(input_text, '')), '^@+', '', 'g');
  cleaned := regexp_replace(cleaned, '[^a-z0-9_]+', '', 'g');
  if length(cleaned) < 3 then
    cleaned := 'user';
  end if;
  cleaned := left(cleaned, 30);
  return '@' || cleaned;
end;
$$;

create or replace function public.generate_unique_handle(input_text text, existing_profile_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_clean text;
  candidate text;
  suffix text;
  i integer := 0;
begin
  base_clean := regexp_replace(substring(public.normalize_handle(input_text) from 2), '[^a-z0-9_]+', '', 'g');
  if length(base_clean) < 3 then
    base_clean := 'user';
  end if;

  loop
    if i = 0 then
      candidate := '@' || left(base_clean, 30);
    else
      suffix := '_' || i::text;
      candidate := '@' || left(base_clean, greatest(3, 30 - char_length(suffix))) || suffix;
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.handle = candidate
        and (existing_profile_id is null or p.id <> existing_profile_id)
    ) then
      return candidate;
    end if;

    i := i + 1;
  end loop;
end;
$$;

update public.profiles
set handle = public.generate_unique_handle(username, id)
where handle is null or handle = '' or handle !~ '^@[a-z0-9_]{3,30}$';

alter table public.profiles
alter column handle set not null;

alter table public.profiles
drop constraint if exists profiles_handle_format_check;

alter table public.profiles
add constraint profiles_handle_format_check
check (handle ~ '^@[a-z0-9_]{3,30}$');

create unique index if not exists idx_profiles_username_lower_unique on public.profiles (lower(username));
create unique index if not exists idx_profiles_handle_unique on public.profiles (handle);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)),
    public.generate_unique_handle(
      coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
      new.id
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

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
      'handle', p.handle,
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

create table if not exists public.creator_spotlights (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  scheduled_for timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_creator_spotlights_scheduled_for on public.creator_spotlights using btree(scheduled_for desc);
create unique index if not exists idx_creator_spotlights_unique_slot on public.creator_spotlights(scheduled_for);

alter table public.creator_spotlights enable row level security;

drop policy if exists "Creator spotlights are viewable by everyone" on public.creator_spotlights;
create policy "Creator spotlights are viewable by everyone"
on public.creator_spotlights for select
to anon, authenticated
using (true);

drop policy if exists "Only admin can manage creator spotlights" on public.creator_spotlights;
create policy "Only admin can manage creator spotlights"
on public.creator_spotlights for all
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "Public read access for banners bucket" on storage.objects;
create policy "Public read access for banners bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'banners');

drop policy if exists "Authenticated upload to banners bucket" on storage.objects;
create policy "Authenticated upload to banners bucket"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'banners'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Owner can update banner objects" on storage.objects;
create policy "Owner can update banner objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'banners'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'banners'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Owner can delete banner objects" on storage.objects;
create policy "Owner can delete banner objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'banners'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
