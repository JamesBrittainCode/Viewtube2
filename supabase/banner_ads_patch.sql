-- Homepage banner ads managed from ViewTube Studio.

create table if not exists public.banner_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Sponsored',
  image_url text not null,
  click_url text not null,
  placement text not null default 'home_top',
  approved boolean not null default true,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions_count integer not null default 0,
  clicks_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_banner_ads_active_placement
on public.banner_ads using btree(placement, approved, is_active, created_at desc);

alter table public.banner_ads enable row level security;

drop policy if exists "Active banner ads are viewable by everyone" on public.banner_ads;
create policy "Active banner ads are viewable by everyone"
on public.banner_ads for select
using (
  approved = true
  and is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Only admin can manage banner ads" on public.banner_ads;
create policy "Only admin can manage banner ads"
on public.banner_ads for all
to authenticated
using (
  coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
)
with check (
  coalesce((auth.jwt() ->> 'email'), '') = 'jesuslearningclub@gmail.com'
);
