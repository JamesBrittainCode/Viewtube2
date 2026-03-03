-- ViewTube production schema
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) >= 3),
  handle text not null unique check (handle ~ '^@[a-z0-9_]{3,30}$'),
  avatar_url text,
  banner_url text,
  bio text,
  verified boolean not null default false,
  subscribers_count bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists verified boolean not null default false;
alter table public.profiles
add column if not exists handle text;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  thumbnail_url text,
  video_url text not null,
  tags text[] not null default '{}',
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  search_vector tsvector not null default ''::tsvector
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subscriber_id, creator_id),
  check (subscriber_id <> creator_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_spotlights (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  scheduled_for timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles using btree(username);
create unique index if not exists idx_profiles_username_lower_unique on public.profiles (lower(username));
create unique index if not exists idx_profiles_handle_unique on public.profiles (handle);
create index if not exists idx_videos_user_id on public.videos using btree(user_id);
create index if not exists idx_videos_created_at on public.videos using btree(created_at desc);
create index if not exists idx_videos_views on public.videos using btree(views desc);
create index if not exists idx_videos_tags on public.videos using gin(tags);
create index if not exists idx_videos_search_vector on public.videos using gin(search_vector);
create index if not exists idx_comments_video_id on public.comments using btree(video_id);
create index if not exists idx_comments_parent_id on public.comments using btree(parent_id);
create index if not exists idx_likes_video_id on public.likes using btree(video_id);
create index if not exists idx_likes_user_id on public.likes using btree(user_id);
create index if not exists idx_subscriptions_subscriber_id on public.subscriptions using btree(subscriber_id);
create index if not exists idx_subscriptions_creator_id on public.subscriptions using btree(creator_id);
create index if not exists idx_notifications_user_id on public.notifications using btree(user_id);
create index if not exists idx_creator_spotlights_scheduled_for on public.creator_spotlights using btree(scheduled_for desc);
create unique index if not exists idx_creator_spotlights_unique_slot on public.creator_spotlights(scheduled_for);

create or replace function public.videos_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new.tags, '{}'), ' ')), 'C');
  return new;
end;
$$;

drop trigger if exists videos_search_vector_trigger on public.videos;
create trigger videos_search_vector_trigger
before insert or update of title, description, tags
on public.videos
for each row
execute function public.videos_search_vector_update();

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.update_subscriber_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set subscribers_count = subscribers_count + 1
    where id = new.creator_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set subscribers_count = greatest(0, subscribers_count - 1)
    where id = old.creator_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists subscriptions_subscriber_count_trigger on public.subscriptions;
create trigger subscriptions_subscriber_count_trigger
after insert or delete on public.subscriptions
for each row execute function public.update_subscriber_count();

create or replace function public.notify_new_subscriber()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, message)
  values (new.creator_id, new.subscriber_id, 'new_subscriber', 'You have a new subscriber');
  return new;
end;
$$;

drop trigger if exists subscriptions_notify_trigger on public.subscriptions;
create trigger subscriptions_notify_trigger
after insert on public.subscriptions
for each row execute function public.notify_new_subscriber();

create or replace function public.notify_video_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select v.user_id into owner_id
  from public.videos v
  where v.id = new.video_id;

  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, message)
    values (owner_id, new.user_id, 'new_comment', 'Someone commented on your video');
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify_trigger on public.comments;
create trigger comments_notify_trigger
after insert on public.comments
for each row execute function public.notify_video_comment();

create or replace function public.notify_new_video_to_subscribers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, message)
  select
    s.subscriber_id,
    new.user_id,
    'new_video',
    'A creator you subscribe to uploaded: ' || new.title
  from public.subscriptions s
  where s.creator_id = new.user_id;

  return new;
end;
$$;

drop trigger if exists videos_notify_subscribers_trigger on public.videos;
create trigger videos_notify_subscribers_trigger
after insert on public.videos
for each row execute function public.notify_new_video_to_subscribers();

create or replace function public.notify_verified_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.verified is distinct from new.verified and new.verified = true then
    insert into public.notifications (user_id, actor_id, type, message)
    values (new.id, (select auth.uid()), 'verified', 'You''ve Been Verified! Congrats! 🎉');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_notify_verified_trigger on public.profiles;
create trigger profiles_notify_verified_trigger
after update of verified on public.profiles
for each row execute function public.notify_verified_status_change();

create or replace function public.increment_video_views(video_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.videos
  set views = views + 1
  where id = video_id;
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

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.creator_spotlights enable row level security;

-- profiles
create policy "Profiles are viewable by everyone"
on public.profiles for select
to anon, authenticated
using (true);

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

-- videos
create policy "Videos are viewable by everyone"
on public.videos for select
to anon, authenticated
using (true);

create policy "Authenticated users can create videos"
on public.videos for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own videos"
on public.videos for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own videos"
on public.videos for delete
to authenticated
using ((select auth.uid()) = user_id);

-- comments
create policy "Comments are viewable by everyone"
on public.comments for select
to anon, authenticated
using (true);

create policy "Authenticated users can create comments"
on public.comments for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own comments"
on public.comments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own comments"
on public.comments for delete
to authenticated
using ((select auth.uid()) = user_id);

-- likes
create policy "Likes are viewable by everyone"
on public.likes for select
to anon, authenticated
using (true);

create policy "Users can manage own likes"
on public.likes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- subscriptions
create policy "Subscriptions are viewable by everyone"
on public.subscriptions for select
to anon, authenticated
using (true);

create policy "Users can create own subscriptions"
on public.subscriptions for insert
to authenticated
with check ((select auth.uid()) = subscriber_id);

create policy "Users can delete own subscriptions"
on public.subscriptions for delete
to authenticated
using ((select auth.uid()) = subscriber_id);

-- notifications
create policy "Users can view own notifications"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- creator spotlights
create policy "Creator spotlights are viewable by everyone"
on public.creator_spotlights for select
to anon, authenticated
using (true);

create policy "Only admin can manage creator spotlights"
on public.creator_spotlights for all
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

create policy "Public read access for videos bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'videos');

create policy "Authenticated upload to videos bucket"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Owner can update videos bucket objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Owner can delete videos bucket objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Public read access for thumbnails bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'thumbnails');

create policy "Authenticated upload to thumbnails bucket"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Owner can update thumbnails objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Owner can delete thumbnails objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'thumbnails'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Public read access for avatars bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "Authenticated upload to avatars bucket"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Owner can update avatar objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Owner can delete avatar objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Public read access for banners bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'banners');

create policy "Authenticated upload to banners bucket"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'banners'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

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

create policy "Owner can delete banner objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'banners'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
