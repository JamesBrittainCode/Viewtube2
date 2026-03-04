-- Apply admin profile controls + verified badge support on existing projects.

alter table public.profiles
add column if not exists verified boolean not null default false;
alter table public.profiles
add column if not exists handle text;
alter table public.profiles
add column if not exists suspended boolean not null default false;
alter table public.profiles
add column if not exists suspension_reason text;
alter table public.profiles
add column if not exists suspended_at timestamptz;
alter table public.profiles
add column if not exists moderation_strikes integer not null default 0;
alter table public.videos
add column if not exists comments_enabled boolean not null default true;
alter table public.comments
add column if not exists pinned boolean not null default false;

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);

create index if not exists idx_comments_video_pinned_created on public.comments using btree(video_id, pinned desc, created_at asc);
create index if not exists idx_comment_likes_comment_id on public.comment_likes using btree(comment_id);
create index if not exists idx_comment_likes_user_id on public.comment_likes using btree(user_id);

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
  and suspended = (select p.suspended from public.profiles p where p.id = (select auth.uid()))
  and suspension_reason is not distinct from (select p.suspension_reason from public.profiles p where p.id = (select auth.uid()))
  and suspended_at is not distinct from (select p.suspended_at from public.profiles p where p.id = (select auth.uid()))
  and moderation_strikes = (select p.moderation_strikes from public.profiles p where p.id = (select auth.uid()))
);

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

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  title text not null default '',
  description text not null default '',
  tags text[] not null default '{}',
  video_url text,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  video_url text not null,
  click_url text not null,
  thumbnail_url text,
  runtime_seconds integer not null default 0,
  target_reach integer,
  calculated_price_usd numeric(10,2),
  skippable boolean not null default true,
  impressions_count integer not null default 0,
  clicks_count integer not null default 0,
  completions_count integer not null default 0,
  last_served_at timestamptz,
  approved boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  source_submission_id uuid,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_submissions (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  position_title text not null,
  company_name text not null,
  submitter_email text not null,
  contact_email text not null,
  ad_title text not null,
  click_url text not null,
  video_url text not null,
  thumbnail_url text,
  runtime_seconds integer not null default 0,
  target_reach integer not null default 10000,
  calculated_price_usd numeric(10,2),
  skippable boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  paypal_transaction_id text,
  payment_amount_usd numeric(10,2),
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,
  status text not null default 'pending',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  converted_ad_id uuid references public.ads(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ads
add column if not exists runtime_seconds integer not null default 0;
alter table public.ads
add column if not exists target_reach integer;
alter table public.ads
add column if not exists calculated_price_usd numeric(10,2);
alter table public.ads
add column if not exists approved boolean not null default false;
alter table public.ads
add column if not exists impressions_count integer not null default 0;
alter table public.ads
add column if not exists clicks_count integer not null default 0;
alter table public.ads
add column if not exists completions_count integer not null default 0;
alter table public.ads
add column if not exists last_served_at timestamptz;
alter table public.ads
add column if not exists starts_at timestamptz;
alter table public.ads
add column if not exists ends_at timestamptz;
alter table public.ads
add column if not exists source_submission_id uuid;
alter table public.ad_submissions
add column if not exists target_reach integer not null default 10000;
alter table public.ad_submissions
add column if not exists submitter_email text;
alter table public.ad_submissions
add column if not exists calculated_price_usd numeric(10,2);
alter table public.ad_submissions
add column if not exists payment_provider text;
alter table public.ad_submissions
add column if not exists payment_reference text;
alter table public.ad_submissions
add column if not exists paid_at timestamptz;
alter table public.ad_submissions
alter column paypal_transaction_id drop not null;
update public.ad_submissions
set submitter_email = lower(contact_email)
where submitter_email is null;
alter table public.ad_submissions
alter column submitter_email set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ads_source_submission_id_fkey'
      and conrelid = 'public.ads'::regclass
  ) then
    alter table public.ads
    add constraint ads_source_submission_id_fkey
    foreign key (source_submission_id)
    references public.ad_submissions(id)
    on delete set null;
  end if;
end;
$$;

create index if not exists idx_moderation_events_user_id on public.moderation_events using btree(user_id, created_at desc);
create index if not exists idx_ads_active_created_at on public.ads using btree(is_active, created_at desc);
create index if not exists idx_ads_schedule on public.ads using btree(approved, is_active, starts_at, ends_at);
create index if not exists idx_ad_submissions_status_created_at on public.ad_submissions using btree(status, created_at desc);

alter table public.moderation_events enable row level security;
alter table public.ads enable row level security;
alter table public.ad_submissions enable row level security;
alter table public.comment_likes enable row level security;
alter table public.notifications
add column if not exists target_url text;

drop policy if exists "Users can view own moderation events" on public.moderation_events;
create policy "Users can view own moderation events"
on public.moderation_events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own comments" on public.comments;
create policy "Users can update own comments"
on public.comments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Video owners can update comments on own videos" on public.comments;
create policy "Video owners can update comments on own videos"
on public.comments for update
to authenticated
using (
  exists (
    select 1
    from public.videos v
    where v.id = video_id
      and v.user_id = (select auth.uid())
  )
)
with check (true);

drop policy if exists "Users can delete own comments" on public.comments;
create policy "Users can delete own comments"
on public.comments for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Video owners can delete comments on own videos" on public.comments;
create policy "Video owners can delete comments on own videos"
on public.comments for delete
to authenticated
using (
  exists (
    select 1
    from public.videos v
    where v.id = video_id
      and v.user_id = (select auth.uid())
  )
);

drop policy if exists "Comment likes are viewable by everyone" on public.comment_likes;
create policy "Comment likes are viewable by everyone"
on public.comment_likes for select
to anon, authenticated
using (true);

drop policy if exists "Users can manage own comment likes" on public.comment_likes;
create policy "Users can manage own comment likes"
on public.comment_likes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Active ads are viewable by everyone" on public.ads;
create policy "Active ads are viewable by everyone"
on public.ads for select
to anon, authenticated
using (
  is_active = true
  and approved = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Only admin can manage ads" on public.ads;
create policy "Only admin can manage ads"
on public.ads for all
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

drop policy if exists "Advertisers can view own launched ads" on public.ads;
create policy "Advertisers can view own launched ads"
on public.ads for select
to authenticated
using (
  exists (
    select 1
    from public.ad_submissions s
    where s.converted_ad_id = id
      and lower(s.submitter_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  )
);

drop policy if exists "Advertisers can create ad submissions" on public.ad_submissions;
create policy "Advertisers can create ad submissions"
on public.ad_submissions for insert
to authenticated
with check (
  status = 'pending'
  and lower(submitter_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

drop policy if exists "Advertisers can view own ad submissions" on public.ad_submissions;
create policy "Advertisers can view own ad submissions"
on public.ad_submissions for select
to authenticated
using (
  lower(submitter_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

drop policy if exists "Advertisers can update own approved submissions for payment" on public.ad_submissions;
create policy "Advertisers can update own approved submissions for payment"
on public.ad_submissions for update
to authenticated
using (
  false
)
with check (
  false
);

drop policy if exists "Only admin can view ad submissions" on public.ad_submissions;
create policy "Only admin can view ad submissions"
on public.ad_submissions for select
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

drop policy if exists "Only admin can manage ad submissions" on public.ad_submissions;
create policy "Only admin can manage ad submissions"
on public.ad_submissions for update
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create or replace function public.record_moderation_violation(
  target_user_id uuid,
  violation_reason text,
  input_title text,
  input_description text,
  input_tags text[],
  input_video_url text,
  input_thumbnail_url text
)
returns table (
  strikes integer,
  is_suspended boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid;
  next_strikes integer;
  suspended_now boolean;
begin
  caller_id := auth.uid();

  if caller_id is null or caller_id <> target_user_id then
    raise exception 'Unauthorized';
  end if;

  insert into public.moderation_events (
    user_id,
    reason,
    title,
    description,
    tags,
    video_url,
    thumbnail_url
  ) values (
    target_user_id,
    coalesce(violation_reason, 'Policy violation'),
    coalesce(input_title, ''),
    coalesce(input_description, ''),
    coalesce(input_tags, '{}'),
    input_video_url,
    input_thumbnail_url
  );

  update public.profiles
  set moderation_strikes = moderation_strikes + 1
  where id = target_user_id
  returning moderation_strikes into next_strikes;

  if next_strikes >= 5 then
    update public.profiles
    set
      suspended = true,
      suspension_reason = 'Automatic moderation suspension after 5 removed uploads',
      suspended_at = coalesce(suspended_at, now())
    where id = target_user_id;
    suspended_now := true;

    insert into public.notifications (user_id, type, message)
    values (
      target_user_id,
      'account_suspended',
      'Your account has been suspended after repeated moderation violations. Contact support@viewtube.heyrivo.com.'
    );
  else
    suspended_now := false;
  end if;

  return query select next_strikes, suspended_now;
end;
$$;

create or replace function public.push_notification(
  target_user_id uuid,
  target_type text,
  target_message text,
  target_actor_id uuid default null,
  target_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if target_actor_id is not null and target_actor_id <> auth.uid() then
    raise exception 'Unauthorized';
  end if;

  insert into public.notifications (user_id, actor_id, type, message)
  values (target_user_id, target_actor_id, target_type, target_message, target_url);
end;
$$;

grant execute on function public.push_notification(uuid, text, text, uuid, text) to authenticated;

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

insert into storage.buckets (id, name, public)
values ('ads', 'ads', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('ad-submissions', 'ad-submissions', true)
on conflict (id) do nothing;

drop policy if exists "Public read access for banners bucket" on storage.objects;
create policy "Public read access for banners bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'banners');

drop policy if exists "Public read access for ads bucket" on storage.objects;
create policy "Public read access for ads bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'ads');

drop policy if exists "Public read access for ad submissions bucket" on storage.objects;
create policy "Public read access for ad submissions bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'ad-submissions');

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

drop policy if exists "Only admin uploads ads bucket objects" on storage.objects;
create policy "Only admin uploads ads bucket objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ads'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

drop policy if exists "Only admin updates ads bucket objects" on storage.objects;
create policy "Only admin updates ads bucket objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ads'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
)
with check (
  bucket_id = 'ads'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

drop policy if exists "Only admin deletes ads bucket objects" on storage.objects;
create policy "Only admin deletes ads bucket objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ads'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

drop policy if exists "Public upload to ad submissions bucket" on storage.objects;
create policy "Public upload to ad submissions bucket"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'ad-submissions');

drop policy if exists "Only admin updates ad submissions bucket objects" on storage.objects;
create policy "Only admin updates ad submissions bucket objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ad-submissions'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
)
with check (
  bucket_id = 'ad-submissions'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

drop policy if exists "Only admin deletes ad submissions bucket objects" on storage.objects;
create policy "Only admin deletes ad submissions bucket objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ad-submissions'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);
