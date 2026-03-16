-- Adds duration_seconds to videos for thumbnail time badges (idempotent).

alter table public.videos
add column if not exists duration_seconds integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'videos_duration_seconds_nonneg'
  ) then
    alter table public.videos
      add constraint videos_duration_seconds_nonneg
      check (duration_seconds is null or duration_seconds >= 0);
  end if;
end $$;

