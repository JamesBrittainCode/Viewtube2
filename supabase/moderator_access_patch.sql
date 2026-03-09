-- Add moderator access role on profiles (idempotent).

alter table public.profiles
add column if not exists can_moderate boolean not null default false;

create index if not exists idx_profiles_can_moderate on public.profiles using btree(can_moderate);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and subscribers_count = (select p.subscribers_count from public.profiles p where p.id = (select auth.uid()))
  and verified = (select p.verified from public.profiles p where p.id = (select auth.uid()))
  and suspended = (select p.suspended from public.profiles p where p.id = (select auth.uid()))
  and suspension_reason is not distinct from (select p.suspension_reason from public.profiles p where p.id = (select auth.uid()))
  and suspended_at is not distinct from (select p.suspended_at from public.profiles p where p.id = (select auth.uid()))
  and can_stream_live = (select p.can_stream_live from public.profiles p where p.id = (select auth.uid()))
  and can_moderate = (select p.can_moderate from public.profiles p where p.id = (select auth.uid()))
  and moderation_strikes = (select p.moderation_strikes from public.profiles p where p.id = (select auth.uid()))
);
