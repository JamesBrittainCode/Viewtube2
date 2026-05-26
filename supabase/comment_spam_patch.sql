-- Comment anti-spam patch (idempotent).
-- Adds lightweight fields used by the API to temporarily suspend comment posting.

alter table public.profiles
add column if not exists comment_suspended_until timestamptz;

alter table public.profiles
add column if not exists comment_spam_strikes integer not null default 0;

create index if not exists idx_profiles_comment_suspended_until on public.profiles using btree(comment_suspended_until);

