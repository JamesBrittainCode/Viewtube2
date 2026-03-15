-- Petition votes (idempotent). Each authenticated user can sign once per petition_key.

create table if not exists public.petition_votes (
  id uuid primary key default gen_random_uuid(),
  petition_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (petition_key, user_id)
);

create index if not exists idx_petition_votes_petition_key on public.petition_votes using btree(petition_key);
create index if not exists idx_petition_votes_user_id on public.petition_votes using btree(user_id);

alter table public.petition_votes enable row level security;

drop policy if exists "Petition votes are viewable by everyone" on public.petition_votes;
create policy "Petition votes are viewable by everyone"
on public.petition_votes for select
to anon, authenticated
using (true);

drop policy if exists "Users can sign petition once" on public.petition_votes;
create policy "Users can sign petition once"
on public.petition_votes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can remove own petition vote" on public.petition_votes;
create policy "Users can remove own petition vote"
on public.petition_votes for delete
to authenticated
using (auth.uid() = user_id);

