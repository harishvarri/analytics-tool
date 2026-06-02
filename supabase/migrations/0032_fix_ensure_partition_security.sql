-- =============================================================================
-- Migration 0032 — Fix ensure_events_partition permission denied
-- =============================================================================
-- The GitHub Actions "Ensure event partitions" step failed with:
--   "2026-08-01: permission denied for schema public"
--
-- Root cause: ensure_events_partition() was defined WITHOUT security definer,
-- so when called via the service-role RPC it ran as `service_role`, which does
-- not hold CREATE on schema public — so `CREATE TABLE ... PARTITION OF` was
-- rejected. (refresh_analytics_aggregates already uses security definer, which
-- is why the refresh step succeeds and only partition creation fails.)
--
-- Fix: recreate the function as SECURITY DEFINER so it runs as the owner
-- (postgres), which can create partition tables. search_path pinned for safety.
-- =============================================================================

create or replace function public.ensure_events_partition(p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  start_date date := date_trunc('month', p_month)::date;
  end_date   date := (start_date + interval '1 month')::date;
  part_name  text := format('analytics_events_y%sm%s',
                            to_char(start_date, 'YYYY'),
                            to_char(start_date, 'MM'));
begin
  if not exists (
    select 1 from pg_class where relname = part_name
  ) then
    execute format(
      'create table public.%I partition of public.analytics_events for values from (%L) to (%L)',
      part_name, start_date, end_date
    );
  end if;
end $$;
