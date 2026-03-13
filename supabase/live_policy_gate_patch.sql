-- Live policy acceptance fields (viewer + creator) stored on profiles (idempotent).

alter table public.profiles
add column if not exists live_viewer_terms_version integer not null default 1;

alter table public.profiles
add column if not exists live_viewer_terms_accepted_at timestamptz;

alter table public.profiles
add column if not exists live_creator_terms_version integer not null default 1;

alter table public.profiles
add column if not exists live_creator_terms_accepted_at timestamptz;

create index if not exists idx_profiles_live_viewer_terms on public.profiles using btree(live_viewer_terms_version, live_viewer_terms_accepted_at);
create index if not exists idx_profiles_live_creator_terms on public.profiles using btree(live_creator_terms_version, live_creator_terms_accepted_at);
