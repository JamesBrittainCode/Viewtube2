-- Raises ViewTube storage bucket upload limits after upgrading Supabase.
-- Run this in the Supabase SQL editor.
-- 1073741824 bytes = 1GB.

update storage.buckets
set file_size_limit = 1073741824
where id in (
  'videos',
  'thumbnails',
  'avatars',
  'banners',
  'ads',
  'ad-submissions',
  'playables'
);
