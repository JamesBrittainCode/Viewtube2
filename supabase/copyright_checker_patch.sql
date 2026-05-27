-- Copyright/music recognition fields on videos
-- Run this in Supabase SQL editor.

alter table public.videos
  add column if not exists copyright_status text,
  add column if not exists copyright_detected boolean,
  add column if not exists copyright_song_title text,
  add column if not exists copyright_artist text,
  add column if not exists copyright_label text,
  add column if not exists copyright_isrc text,
  add column if not exists copyright_upc text,
  add column if not exists copyright_checked_at timestamptz,
  add column if not exists copyright_raw jsonb;

update public.videos
set copyright_status = 'pending'
where copyright_status is null;

update public.videos
set copyright_detected = false
where copyright_detected is null;

