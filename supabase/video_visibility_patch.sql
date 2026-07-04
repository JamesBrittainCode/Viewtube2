alter table public.videos
add column if not exists visibility text not null default 'public'
check (visibility in ('public', 'unlisted', 'private'));

create index if not exists idx_videos_visibility_removed_created
on public.videos using btree(visibility, is_removed, created_at desc);

drop policy if exists "Videos are viewable by everyone" on public.videos;
create policy "Videos are viewable by visibility"
on public.videos for select
to anon, authenticated
using (
  visibility in ('public', 'unlisted')
  or user_id = auth.uid()
);

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
      'verified', p.verified,
      'is_admin', p.is_admin,
      'top_streamer', p.top_streamer,
      'streak_champion', p.streak_champion
    ) as profiles
  from public.videos v
  join public.profiles p on p.id = v.user_id
  where v.visibility = 'public'
    and v.is_removed = false
    and (
      v.search_vector @@ websearch_to_tsquery('english', search_query)
      or v.title ilike ('%' || search_query || '%')
      or v.description ilike ('%' || search_query || '%')
    )
  order by ts_rank(v.search_vector, websearch_to_tsquery('english', search_query)) desc, v.created_at desc;
$$;
