-- Enables realtime UPDATE/DELETE delivery for live chat moderation (idempotent-ish).
-- This is required so pin/delete changes propagate to all viewers instantly.

-- Ensure replica identity supports UPDATE/DELETE payloads.
alter table public.live_chat_messages replica identity full;
alter table public.live_streams replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.live_chat_messages';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_streams'
  ) then
    execute 'alter publication supabase_realtime add table public.live_streams';
  end if;
exception
  when undefined_object then
    -- If publication isn't visible, enable in Supabase:
    -- Database -> Replication -> Realtime -> add tables.
    null;
end $$;

