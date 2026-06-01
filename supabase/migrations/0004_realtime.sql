-- ============================================================================
-- 0004_realtime.sql
-- ============================================================================
-- Enable Supabase Realtime on the tables the dashboard subscribes to.
--
-- Realtime delivery still respects RLS — only authenticated admins (per
-- `is_analytics_admin()`) will receive INSERT/UPDATE payloads. That's the
-- correct posture: the browser never gets the service-role key.
--
-- Partitions inherit publication membership from the parent in PG 15+, so
-- we add the parent once and every monthly partition streams automatically.
-- ============================================================================

-- Ensure REPLICA IDENTITY is FULL so realtime delivers complete row payloads
-- (default is DEFAULT — primary key only — which is insufficient for the feed).
do $$
begin
  if to_regclass('public.analytics_events') is not null then
    alter table public.analytics_events replica identity full;
  end if;

  if to_regclass('public.analytics_sessions') is not null then
    alter table public.analytics_sessions replica identity full;
  end if;
end $$;

-- Add to the supabase_realtime publication. `alter publication ... add table`
-- is idempotent in modern Supabase; guard with a DO block for older versions.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise notice 'Publication supabase_realtime does not exist; skipping realtime registration';
    return;
  end if;

  if to_regclass('public.analytics_events') is not null
    and not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and pr.prrelid = 'public.analytics_events'::regclass
  ) then
    alter publication supabase_realtime add table public.analytics_events;
  end if;

  if to_regclass('public.analytics_sessions') is not null
    and not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and pr.prrelid = 'public.analytics_sessions'::regclass
  ) then
    alter publication supabase_realtime add table public.analytics_sessions;
  end if;
end $$;
