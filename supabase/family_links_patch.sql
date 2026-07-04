create table if not exists public.family_link_codes (
  child_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  allow_post_content boolean not null default true,
  allow_comments boolean not null default true,
  allow_messages boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_id, child_id),
  check (parent_id <> child_id)
);

create table if not exists public.family_blocked_channels (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  blocked_channel_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(parent_id, child_id, blocked_channel_id),
  check (child_id <> blocked_channel_id)
);

create index if not exists idx_family_link_codes_code_expires
on public.family_link_codes using btree(code, expires_at);

create index if not exists idx_family_links_child_active
on public.family_links using btree(child_id, status);

create index if not exists idx_family_links_parent_active
on public.family_links using btree(parent_id, status);

create index if not exists idx_family_blocked_child_channel
on public.family_blocked_channels using btree(child_id, blocked_channel_id);

alter table public.family_link_codes enable row level security;
alter table public.family_links enable row level security;
alter table public.family_blocked_channels enable row level security;

drop policy if exists "Children can manage their link code" on public.family_link_codes;
create policy "Children can manage their link code"
on public.family_link_codes for all
to authenticated
using (child_id = (select auth.uid()))
with check (child_id = (select auth.uid()));

drop policy if exists "Parents and children can read family links" on public.family_links;
create policy "Parents and children can read family links"
on public.family_links for select
to authenticated
using (parent_id = (select auth.uid()) or child_id = (select auth.uid()));

drop policy if exists "Parents can update family links" on public.family_links;
create policy "Parents can update family links"
on public.family_links for update
to authenticated
using (parent_id = (select auth.uid()))
with check (parent_id = (select auth.uid()));

drop policy if exists "Parents and children can read blocked channels" on public.family_blocked_channels;
create policy "Parents and children can read blocked channels"
on public.family_blocked_channels for select
to authenticated
using (parent_id = (select auth.uid()) or child_id = (select auth.uid()));

drop policy if exists "Parents can manage blocked channels" on public.family_blocked_channels;
create policy "Parents can manage blocked channels"
on public.family_blocked_channels for all
to authenticated
using (parent_id = (select auth.uid()))
with check (parent_id = (select auth.uid()));
