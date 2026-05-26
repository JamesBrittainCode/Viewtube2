-- Fix RLS policies for public.viewtube_activity_awards (idempotent).
--
-- Server routes use the signed-in user's JWT (anon key + cookies), so RLS must permit INSERT
-- when user_id matches auth.uid(). We still forbid UPDATE/DELETE.

alter table public.viewtube_activity_awards enable row level security;

drop policy if exists "Users cannot directly modify viewtube activity awards" on public.viewtube_activity_awards;

drop policy if exists "Users can insert their own viewtube activity awards" on public.viewtube_activity_awards;
create policy "Users can insert their own viewtube activity awards"
on public.viewtube_activity_awards
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own viewtube activity awards" on public.viewtube_activity_awards;
create policy "Users can delete their own viewtube activity awards"
on public.viewtube_activity_awards
for delete
using (false);

drop policy if exists "Users can update their own viewtube activity awards" on public.viewtube_activity_awards;
create policy "Users can update their own viewtube activity awards"
on public.viewtube_activity_awards
for update
using (false)
with check (false);

