-- Contest eligibility patch (16+ confirmation)
--
-- Adds a simple per-profile flag used to gate access to the streak/points leaderboard.

alter table public.profiles
add column if not exists age_confirmed_16 boolean not null default false;

alter table public.profiles
add column if not exists age_confirmed_at timestamptz;

create index if not exists idx_profiles_age_confirmed_16 on public.profiles using btree(age_confirmed_16);

