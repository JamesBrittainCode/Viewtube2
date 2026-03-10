-- Site alert banner feature (idempotent).

create table if not exists public.site_alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_alerts_active_created on public.site_alerts using btree(is_active, created_at desc);

alter table public.site_alerts enable row level security;

drop policy if exists "Active site alerts are viewable by everyone" on public.site_alerts;
create policy "Active site alerts are viewable by everyone"
on public.site_alerts for select
to anon, authenticated
using (is_active = true);
