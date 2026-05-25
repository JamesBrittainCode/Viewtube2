-- ViewTube Shorts patch (idempotent).
--
-- Adds metadata required to classify and render Shorts (9:16, <= 3 minutes).

alter table public.videos
add column if not exists is_short boolean not null default false;

alter table public.videos
add column if not exists video_width integer;

alter table public.videos
add column if not exists video_height integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'videos_video_width_nonneg'
  ) then
    alter table public.videos
      add constraint videos_video_width_nonneg
      check (video_width is null or video_width >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'videos_video_height_nonneg'
  ) then
    alter table public.videos
      add constraint videos_video_height_nonneg
      check (video_height is null or video_height >= 0);
  end if;
end $$;

create index if not exists idx_videos_is_short_created_at on public.videos using btree(is_short, created_at desc);

