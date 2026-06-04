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
  top_streamer boolean not null default false,
  can_stream_live boolean not null default false,
  can_moderate boolean not null default false,
  suspended boolean not null default false,
  suspension_reason text,
  suspended_at timestamptz,
  moderation_strikes integer not null default 0 check (moderation_strikes >= 0),
  subscribers_count bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists verified boolean not null default false;
alter table public.profiles
add column if not exists top_streamer boolean not null default false;
alter table public.profiles
add column if not exists can_stream_live boolean not null default false;
alter table public.profiles
add column if not exists can_moderate boolean not null default false;
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

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  comments_enabled boolean not null default true,
  is_removed boolean not null default false,
  removed_reason text,
  removed_at timestamptz,
  removed_by uuid references public.profiles(id) on delete set null,
  thumbnail_url text,
  video_url text not null,
  duration_seconds integer,
  tags text[] not null default '{}',
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  search_vector tsvector not null default ''::tsvector
);

alter table public.videos
add column if not exists comments_enabled boolean not null default true;
alter table public.videos
add column if not exists is_removed boolean not null default false;
alter table public.videos
add column if not exists removed_reason text;
alter table public.videos
add column if not exists removed_at timestamptz;
alter table public.videos
add column if not exists removed_by uuid references public.profiles(id) on delete set null;
alter table public.videos
add column if not exists duration_seconds integer;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.comments
add column if not exists pinned boolean not null default false;

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table if not exists public.dislikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

alter table public.profiles
add column if not exists streak_champion boolean not null default false;

create index if not exists idx_profiles_streak_champion on public.profiles using btree(streak_champion);

update public.profiles set streak_champion = false where streak_champion = true;
update public.profiles
set streak_champion = true
where id = (
  select s.user_id
  from public.viewtube_streaks s
  order by s.points desc, s.current_streak desc, s.longest_streak desc, s.last_active_date desc nulls last, s.updated_at desc
  limit 1
);

create table if not exists public.viewtube_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  points bigint not null default 0 check (points >= 0),
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table public.viewtube_streaks
add column if not exists points bigint;

update public.viewtube_streaks set points = 0 where points is null;

create table if not exists public.viewtube_activity_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, activity_type, target_id)
);

create index if not exists idx_viewtube_activity_awards_user on public.viewtube_activity_awards using btree(user_id);

create table if not exists public.playable_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null,
  high_score integer not null default 0 check (high_score >= 0),
  level integer not null default 1 check (level >= 1),
  plays integer not null default 0 check (plays >= 0),
  last_score integer not null default 0 check (last_score >= 0),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_key)
);

create index if not exists idx_playable_scores_user
  on public.playable_scores using btree(user_id, updated_at desc);

create index if not exists idx_viewtube_streaks_current on public.viewtube_streaks using btree(current_streak);
create index if not exists idx_viewtube_streaks_last_active on public.viewtube_streaks using btree(last_active_date);

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
  target_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open',
  admin_note text,
  resolution_action text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (video_id, reporter_id)
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

alter table public.notifications
add column if not exists target_url text;

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

create table if not exists public.creator_spotlights (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  scheduled_for timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default false,
  expires_at timestamptz,
  sound_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_alerts
add column if not exists expires_at timestamptz;
alter table public.site_alerts
add column if not exists sound_enabled boolean not null default true;

-- Site-wide popups (distinct from the banner alerts)
create table if not exists public.site_popups (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default false,
  expires_at timestamptz,
  sound_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_popups
add column if not exists expires_at timestamptz;
alter table public.site_popups
add column if not exists sound_enabled boolean not null default true;

create table if not exists public.studio_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default '',
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.earn_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  channel_focus text not null default '',
  why_join text not null,
  status text not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Live Stream',
  description text not null default '',
  -- Delivery source for live playback.
  -- `webrtc`: in-browser camera/mic streaming.
  -- `obs`: external RTMP ingest that produces HLS for playback.
  source text not null default 'webrtc',
  is_live boolean not null default true,
  is_paused boolean not null default false,
  paused_reason text,
  paused_at timestamptz,
  paused_by uuid references public.profiles(id) on delete set null,
  thumbnail_url text,
  -- For OBS/RTMP ingest, this is the RTMP "stream name" used to derive HLS playback.
  ingest_stream_name text,
  chat_enabled boolean not null default true,
  chat_subscribers_only boolean not null default false,
  chat_slow_mode_seconds integer not null default 0,
  viewer_count integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.live_streams
add column if not exists is_paused boolean not null default false;
alter table public.live_streams
add column if not exists paused_reason text;
alter table public.live_streams
add column if not exists paused_at timestamptz;
alter table public.live_streams
add column if not exists paused_by uuid references public.profiles(id) on delete set null;

-- OBS/RTMP stream keys (stored hashed; never store plaintext).
create table if not exists public.live_stream_keys (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  key_hash text not null unique,
  key_last4 text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

-- OBS/RTMP stream draft settings saved in Studio, used when ingest goes live.
create table if not exists public.live_stream_configs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  title text not null default 'Live Stream',
  description text not null default '',
  thumbnail_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_stream_viewers (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (stream_id, user_id)
);

create table if not exists public.live_signals (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  pinned boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles using btree(username);
create unique index if not exists idx_profiles_username_lower_unique on public.profiles (lower(username));
create unique index if not exists idx_profiles_handle_unique on public.profiles (handle);
create index if not exists idx_profiles_can_stream_live on public.profiles using btree(can_stream_live);
create index if not exists idx_profiles_can_moderate on public.profiles using btree(can_moderate);
create index if not exists idx_videos_user_id on public.videos using btree(user_id);
create index if not exists idx_videos_created_at on public.videos using btree(created_at desc);
create index if not exists idx_videos_removed on public.videos using btree(is_removed, created_at desc);
create index if not exists idx_videos_views on public.videos using btree(views desc);
create index if not exists idx_videos_tags on public.videos using gin(tags);
create index if not exists idx_videos_search_vector on public.videos using gin(search_vector);
create index if not exists idx_comments_video_id on public.comments using btree(video_id);
create index if not exists idx_comments_parent_id on public.comments using btree(parent_id);
create index if not exists idx_comments_video_pinned_created on public.comments using btree(video_id, pinned desc, created_at asc);
create index if not exists idx_comment_likes_comment_id on public.comment_likes using btree(comment_id);
create index if not exists idx_comment_likes_user_id on public.comment_likes using btree(user_id);
create index if not exists idx_likes_video_id on public.likes using btree(video_id);
create index if not exists idx_likes_user_id on public.likes using btree(user_id);
create index if not exists idx_dislikes_video_id on public.dislikes using btree(video_id);
create index if not exists idx_dislikes_user_id on public.dislikes using btree(user_id);
create index if not exists idx_subscriptions_subscriber_id on public.subscriptions using btree(subscriber_id);
create index if not exists idx_subscriptions_creator_id on public.subscriptions using btree(creator_id);
create index if not exists idx_notifications_user_id on public.notifications using btree(user_id);
create index if not exists idx_video_reports_status_created on public.video_reports using btree(status, created_at desc);
create index if not exists idx_video_reports_video_id on public.video_reports using btree(video_id);
create index if not exists idx_ads_active_created_at on public.ads using btree(is_active, created_at desc);
create index if not exists idx_ads_schedule on public.ads using btree(approved, is_active, starts_at, ends_at);
create index if not exists idx_ad_submissions_status_created_at on public.ad_submissions using btree(status, created_at desc);
create index if not exists idx_moderation_events_user_id on public.moderation_events using btree(user_id, created_at desc);
create index if not exists idx_creator_spotlights_scheduled_for on public.creator_spotlights using btree(scheduled_for desc);
create unique index if not exists idx_creator_spotlights_unique_slot on public.creator_spotlights(scheduled_for);
create index if not exists idx_site_alerts_active_created on public.site_alerts using btree(is_active, created_at desc);
create index if not exists idx_site_alerts_active_expires on public.site_alerts using btree(is_active, expires_at desc);
create index if not exists idx_site_popups_active_created on public.site_popups using btree(is_active, created_at desc);
create index if not exists idx_site_popups_active_expires on public.site_popups using btree(is_active, expires_at desc);
create index if not exists idx_studio_feedback_user_created on public.studio_feedback using btree(user_id, created_at desc);
create index if not exists idx_studio_feedback_status_created on public.studio_feedback using btree(status, created_at desc);
create index if not exists idx_earn_applications_status_created on public.earn_applications using btree(status, created_at desc);
create index if not exists idx_live_streams_live_started on public.live_streams using btree(is_live, started_at desc);
create index if not exists idx_live_streams_user_live on public.live_streams using btree(user_id, is_live);
create index if not exists idx_live_streams_source_live on public.live_streams using btree(source, is_live, started_at desc);
create index if not exists idx_live_stream_viewers_stream on public.live_stream_viewers using btree(stream_id);
create index if not exists idx_live_signals_stream_created on public.live_signals using btree(stream_id, created_at asc);
create index if not exists idx_live_signals_recipient on public.live_signals using btree(recipient_id, created_at asc);
create index if not exists idx_live_chat_stream_created on public.live_chat_messages using btree(stream_id, created_at asc);
create index if not exists idx_live_chat_stream_pinned_created on public.live_chat_messages using btree(stream_id, pinned desc, created_at desc);

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
      'Your account has been suspended after repeated moderation violations. Contact support@viewtube.tv.'
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
alter table public.comment_likes enable row level security;
alter table public.likes enable row level security;
alter table public.dislikes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.video_reports enable row level security;
alter table public.ads enable row level security;
alter table public.ad_submissions enable row level security;
alter table public.moderation_events enable row level security;
alter table public.creator_spotlights enable row level security;
alter table public.site_alerts enable row level security;
alter table public.studio_feedback enable row level security;
alter table public.earn_applications enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_stream_viewers enable row level security;
alter table public.live_signals enable row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_stream_keys enable row level security;
alter table public.live_stream_configs enable row level security;
alter table public.site_popups enable row level security;
alter table public.playable_scores enable row level security;

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
  and top_streamer = (select p.top_streamer from public.profiles p where p.id = (select auth.uid()))
  and suspended = (select p.suspended from public.profiles p where p.id = (select auth.uid()))
  and suspension_reason is not distinct from (select p.suspension_reason from public.profiles p where p.id = (select auth.uid()))
  and suspended_at is not distinct from (select p.suspended_at from public.profiles p where p.id = (select auth.uid()))
  and can_stream_live = (select p.can_stream_live from public.profiles p where p.id = (select auth.uid()))
  and can_moderate = (select p.can_moderate from public.profiles p where p.id = (select auth.uid()))
  and moderation_strikes = (select p.moderation_strikes from public.profiles p where p.id = (select auth.uid()))
);

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

-- Backwards compatible wrapper (older deployments may still call 4-arg version).
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

create policy "Users can delete own comments"
on public.comments for delete
to authenticated
using ((select auth.uid()) = user_id);

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

-- comment likes
create policy "Comment likes are viewable by everyone"
on public.comment_likes for select
to anon, authenticated
using (true);

create policy "Users can manage own comment likes"
on public.comment_likes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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

-- dislikes
create policy "Dislikes are viewable by everyone"
on public.dislikes for select
to anon, authenticated
using (true);

create policy "Users can manage own dislikes"
on public.dislikes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter table public.viewtube_streaks enable row level security;

create policy "ViewTube streaks are viewable by everyone"
on public.viewtube_streaks for select
to anon, authenticated
using (true);

create policy "Users cannot directly modify viewtube streaks"
on public.viewtube_streaks for all
to authenticated
using (false)
with check (false);

alter table public.viewtube_activity_awards enable row level security;

create policy "ViewTube activity awards are viewable by everyone"
on public.viewtube_activity_awards for select
to anon, authenticated
using (true);

create policy "Users cannot directly modify viewtube activity awards"
on public.viewtube_activity_awards for all
to authenticated
using (false)
with check (false);

create policy "Playable scores are viewable by owner"
on public.playable_scores for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own playable scores"
on public.playable_scores for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own playable scores"
on public.playable_scores for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_playable_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists playable_scores_set_updated_at on public.playable_scores;
create trigger playable_scores_set_updated_at
before update on public.playable_scores
for each row execute function public.set_playable_scores_updated_at();

create or replace function public.record_viewtube_activity_v2(
  activity_type text default null,
  target_id text default null,
  points_ok boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  today_utc date;
  prev_last date;
  prev_current integer;
  updated public.viewtube_streaks;
  advanced boolean;
  champion_before uuid;
  champion_after uuid;
  points_delta bigint;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Unauthorized';
  end if;

  today_utc := (now() at time zone 'utc')::date;

  points_delta := case coalesce(activity_type, '')
    when 'upload_video' then 25
    when 'go_live' then 20
    when 'comment' then 8
    when 'subscribe' then 6
    when 'video_like' then 2
    when 'comment_like' then 2
    else 1
  end;

  if points_ok is not true then
    points_delta := 0;
  end if;

  select last_active_date, current_streak
  into prev_last, prev_current
  from public.viewtube_streaks
  where user_id = uid;

  advanced := coalesce(prev_last is distinct from today_utc, true);

  insert into public.viewtube_streaks (user_id, current_streak, longest_streak, points, last_active_date, updated_at)
  values (uid, 1, 1, points_delta, today_utc, now())
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

  select s.user_id
  into champion_after
  from public.viewtube_streaks s
  order by s.points desc, s.current_streak desc, s.longest_streak desc, s.last_active_date desc nulls last, s.updated_at desc
  limit 1;

  if champion_after is not null and champion_before is distinct from champion_after then
    if champion_before is not null then
      update public.profiles set streak_champion = false where id = champion_before;
    end if;
    update public.profiles set streak_champion = true where id = champion_after;
  end if;

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

create or replace function public.record_viewtube_activity(activity_type text default null)
returns public.viewtube_streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  uid uuid;
  row public.viewtube_streaks;
begin
  payload := public.record_viewtube_activity_v2(activity_type, null, true);
  uid := auth.uid();
  select * into row from public.viewtube_streaks where user_id = uid;
  return row;
end;
$$;

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

create policy "Users can report videos"
on public.video_reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

create policy "Users can view own reports"
on public.video_reports for select
to authenticated
using ((select auth.uid()) = reporter_id);

create policy "Only admin can view reports"
on public.video_reports for select
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Only admin can manage reports"
on public.video_reports for update
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

-- ads
create policy "Active ads are viewable by everyone"
on public.ads for select
to anon, authenticated
using (
  is_active = true
  and approved = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

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

create policy "Only admin can manage ads"
on public.ads for all
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Advertisers can create ad submissions"
on public.ad_submissions for insert
to authenticated
with check (
  status = 'pending'
  and lower(submitter_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

create policy "Advertisers can view own ad submissions"
on public.ad_submissions for select
to authenticated
using (
  lower(submitter_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

create policy "Advertisers can update own approved submissions for payment"
on public.ad_submissions for update
to authenticated
using (
  false
)
with check (
  false
);

create policy "Only admin can view ad submissions"
on public.ad_submissions for select
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Only admin can manage ad submissions"
on public.ad_submissions for update
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

-- moderation events
create policy "Users can view own moderation events"
on public.moderation_events for select
to authenticated
using ((select auth.uid()) = user_id);

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

create policy "Users can create own studio feedback"
on public.studio_feedback for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can view own studio feedback"
on public.studio_feedback for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Only admin can view studio feedback"
on public.studio_feedback for select
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Only admin can update studio feedback"
on public.studio_feedback for update
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Users can create own earn applications"
on public.earn_applications for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can view own earn applications"
on public.earn_applications for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update own pending earn applications"
on public.earn_applications for update
to authenticated
using ((select auth.uid()) = user_id and status = 'pending')
with check ((select auth.uid()) = user_id and status = 'pending');

create policy "Only admin can view earn applications"
on public.earn_applications for select
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Only admin can manage earn applications"
on public.earn_applications for update
to authenticated
using (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com')
with check (coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com');

create policy "Live streams are viewable by everyone"
on public.live_streams for select
to anon, authenticated
using (true);

create policy "Eligible users can create live streams"
on public.live_streams for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.can_stream_live = true
  )
);

create policy "Stream owners can update own streams"
on public.live_streams for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  -- Prevent creators from changing admin-controlled pause state.
  and is_paused = (select s.is_paused from public.live_streams s where s.id = id)
  and paused_reason is not distinct from (select s.paused_reason from public.live_streams s where s.id = id)
  and paused_at is not distinct from (select s.paused_at from public.live_streams s where s.id = id)
  and paused_by is not distinct from (select s.paused_by from public.live_streams s where s.id = id)
);

-- Stream keys: only the owner can manage/view their own key metadata (masked in UI).
drop policy if exists "Users can manage own live stream key" on public.live_stream_keys;
create policy "Users can manage own live stream key"
on public.live_stream_keys for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- OBS configs: only the owner can manage/view their own saved OBS details.
drop policy if exists "Users can manage own live stream config" on public.live_stream_configs;
create policy "Users can manage own live stream config"
on public.live_stream_configs for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Live stream viewers are viewable by stream owners"
on public.live_stream_viewers for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.user_id = (select auth.uid())
  )
);

create policy "Users can manage own live stream presence"
on public.live_stream_viewers for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Participants can view live signals"
on public.live_signals for select
to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or exists (
    select 1
    from public.live_streams s
    where s.id = stream_id
      and s.user_id = (select auth.uid())
  )
);

create policy "Authenticated users can send live signals"
on public.live_signals for insert
to authenticated
with check (sender_id = (select auth.uid()));

create policy "Live chat messages are viewable by everyone"
on public.live_chat_messages for select
to anon, authenticated
using (true);

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

create policy "Active site alerts are viewable by everyone"
on public.site_alerts for select
to anon, authenticated
using (is_active = true and (expires_at is null or expires_at > now()));

create policy "Active site popups are viewable by everyone"
on public.site_popups for select
to anon, authenticated
using (is_active = true and (expires_at is null or expires_at > now()));

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

insert into storage.buckets (id, name, public)
values ('ads', 'ads', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('ad-submissions', 'ad-submissions', true)
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

create policy "Public read access for ads bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'ads');

create policy "Public read access for ad submissions bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'ad-submissions');

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

create policy "Only admin uploads ads bucket objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ads'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

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

create policy "Only admin deletes ads bucket objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ads'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);

create policy "Public upload to ad submissions bucket"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'ad-submissions');

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

create policy "Only admin deletes ad submissions bucket objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ad-submissions'
  and coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);
