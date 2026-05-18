-- Admin live controls + site-wide popup alerts

-- site_alerts: auto expiry + sound flag
alter table public.site_alerts
add column if not exists expires_at timestamptz;

alter table public.site_alerts
add column if not exists sound_enabled boolean not null default true;

create index if not exists idx_site_alerts_active_expires on public.site_alerts using btree(is_active, expires_at desc);

-- Make active alerts selectable only while not expired
drop policy if exists "Active site alerts are viewable by everyone" on public.site_alerts;
create policy "Active site alerts are viewable by everyone"
on public.site_alerts for select
to anon, authenticated
using (is_active = true and (expires_at is null or expires_at > now()));

-- site_popups: separate from banner
create table if not exists public.site_popups (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default false,
  expires_at timestamptz,
  sound_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_popups enable row level security;

create index if not exists idx_site_popups_active_expires on public.site_popups using btree(is_active, expires_at desc);

drop policy if exists "Active site popups are viewable by everyone" on public.site_popups;
create policy "Active site popups are viewable by everyone"
on public.site_popups for select
to anon, authenticated
using (is_active = true and (expires_at is null or expires_at > now()));

-- live_streams: admin pause fields
alter table public.live_streams
add column if not exists is_paused boolean not null default false;

alter table public.live_streams
add column if not exists paused_reason text;

alter table public.live_streams
add column if not exists paused_at timestamptz;

alter table public.live_streams
add column if not exists paused_by uuid references public.profiles(id) on delete set null;
