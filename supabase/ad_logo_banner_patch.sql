-- Separates ad logo artwork from optional companion-card banner artwork.
-- Run this once in Supabase SQL editor before deploying code that reads logo_url/banner_url.

alter table public.ads
  add column if not exists logo_url text,
  add column if not exists banner_url text;

alter table public.ad_submissions
  add column if not exists logo_url text,
  add column if not exists banner_url text;

update public.ads
set logo_url = thumbnail_url
where logo_url is null
  and thumbnail_url is not null;

update public.ad_submissions
set logo_url = thumbnail_url
where logo_url is null
  and thumbnail_url is not null;
