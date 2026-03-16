-- Enables realtime Postgres changes for petition_votes (idempotent-ish).
-- Needed for live vote counters to update as users sign/un-sign.

-- Ensure changes can be replicated for delete events.
alter table public.petition_votes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'petition_votes'
  ) then
    execute 'alter publication supabase_realtime add table public.petition_votes';
  end if;
exception
  when undefined_object then
    -- Some Supabase projects may not have the publication visible to this role.
    -- In that case, enable it in Dashboard: Database -> Replication -> Realtime.
    null;
end $$;

