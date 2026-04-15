-- Adds thumbnail_url support for live streams (idempotent).

alter table public.live_streams
add column if not exists thumbnail_url text;

