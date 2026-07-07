-- Raises ViewTube storage bucket upload limits after upgrading Supabase.
-- Run this in the Supabase SQL editor.
-- 53687091200 bytes = 50GB.
--
-- Supabase Pro supports a global file size limit up to 500GB, but the
-- dashboard global limit must be at least as high as these per-bucket limits.

update storage.buckets
set file_size_limit = 53687091200
where id in (
  'videos',
  'thumbnails',
  'avatars',
  'banners',
  'ads',
  'ad-submissions',
  'playables'
);
