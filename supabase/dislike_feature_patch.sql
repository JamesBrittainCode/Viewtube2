-- Adds dislike support for videos (idempotent).

create table if not exists public.dislikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create index if not exists idx_dislikes_video_id on public.dislikes using btree(video_id);
create index if not exists idx_dislikes_user_id on public.dislikes using btree(user_id);

alter table public.dislikes enable row level security;

drop policy if exists "Dislikes are viewable by everyone" on public.dislikes;
create policy "Dislikes are viewable by everyone"
on public.dislikes for select
to anon, authenticated
using (true);

drop policy if exists "Users can manage own dislikes" on public.dislikes;
create policy "Users can manage own dislikes"
on public.dislikes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
