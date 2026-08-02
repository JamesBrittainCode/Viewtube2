alter table public.live_streams
add column if not exists scheduled_for timestamptz;

alter table public.live_streams
add column if not exists co_host_id uuid references public.profiles(id) on delete set null;

alter table public.live_streams
add column if not exists co_live_invite_id uuid;

alter table public.live_streams
add column if not exists watch_party_video_id uuid references public.videos(id) on delete set null;

create table if not exists public.live_collab_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  stream_id uuid references public.live_streams(id) on delete set null,
  title text not null,
  description text not null default '',
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message text not null default '',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (inviter_id <> invitee_id)
);

create table if not exists public.live_watch_parties (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  stream_id uuid references public.live_streams(id) on delete set null,
  title text not null,
  description text not null default '',
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_live_streams_co_host_live on public.live_streams using btree(co_host_id, is_live);
create index if not exists idx_live_streams_scheduled on public.live_streams using btree(scheduled_for);
create index if not exists idx_live_collab_invites_inviter on public.live_collab_invites using btree(inviter_id, status, scheduled_for);
create index if not exists idx_live_collab_invites_invitee on public.live_collab_invites using btree(invitee_id, status, scheduled_for);
create index if not exists idx_live_collab_invites_stream on public.live_collab_invites using btree(stream_id);
create index if not exists idx_live_watch_parties_creator on public.live_watch_parties using btree(creator_id, status, scheduled_for);
create index if not exists idx_live_watch_parties_video on public.live_watch_parties using btree(video_id, status, scheduled_for);

alter table public.live_collab_invites enable row level security;
alter table public.live_watch_parties enable row level security;

drop policy if exists "Live collab invites are visible to both creators" on public.live_collab_invites;
create policy "Live collab invites are visible to both creators"
on public.live_collab_invites for select
to authenticated
using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));

drop policy if exists "Eligible creators can invite cohosts" on public.live_collab_invites;
create policy "Eligible creators can invite cohosts"
on public.live_collab_invites for insert
to authenticated
with check (
  inviter_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = inviter_id and p.can_stream_live = true)
  and exists (select 1 from public.profiles p where p.id = invitee_id and p.can_stream_live = true)
);

drop policy if exists "Invite participants can update live collab invites" on public.live_collab_invites;
create policy "Invite participants can update live collab invites"
on public.live_collab_invites for update
to authenticated
using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()))
with check (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));

drop policy if exists "Watch parties are visible to everyone" on public.live_watch_parties;
create policy "Watch parties are visible to everyone"
on public.live_watch_parties for select
to anon, authenticated
using (status in ('scheduled', 'live', 'ended'));

drop policy if exists "Eligible creators can manage watch parties" on public.live_watch_parties;
create policy "Eligible creators can manage watch parties"
on public.live_watch_parties for all
to authenticated
using (creator_id = (select auth.uid()))
with check (
  creator_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.can_stream_live = true
  )
);
