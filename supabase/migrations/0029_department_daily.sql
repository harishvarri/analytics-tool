-- =============================================================================
-- Migration 0029 — mv_department_daily (department activity over time)
-- =============================================================================
-- The schema captures analytics_users.department/team but nothing aggregates
-- activity along that dimension. This materialized view powers the Department
-- Analytics page's trend chart ("Recruitment team vs Training team over time").
--
-- Known people only (directory / internal / email-resolved) so anonymous
-- browser traffic never distorts department rollups.
-- =============================================================================

create materialized view if not exists public.mv_department_daily as
  select
    coalesce(u.department, 'Unassigned')                 as department,
    date_trunc('day', e.occurred_at)::date               as day,
    count(*)                                             as events,
    count(distinct e.user_id)
      filter (where e.user_id is not null)               as users,
    count(distinct e.session_id)
      filter (where e.session_id is not null)            as sessions,
    count(*) filter (where e.category = 'error')         as errors
  from public.analytics_events e
  join public.analytics_users u on u.id = e.user_id
  where (u.source = 'directory' or u.is_internal or u.email is not null)
  group by 1, 2
  with no data;

-- Unique index is REQUIRED for REFRESH ... CONCURRENTLY.
create unique index if not exists mv_department_daily_pk
  on public.mv_department_daily (department, day);
create index if not exists mv_department_daily_day_idx
  on public.mv_department_daily (day desc);

-- Initial non-concurrent populate so CONCURRENTLY is valid from the first cron run.
refresh materialized view public.mv_department_daily;

-- ── Register in the refresh entry point ──────────────────────────────────────
-- Self-healing variant (matches 0026): try CONCURRENTLY, fall back to plain
-- REFRESH on first run for any empty MV.
create or replace function public.refresh_analytics_aggregates()
returns void language plpgsql security definer set search_path = public as $$
begin
  begin refresh materialized view concurrently public.mv_portal_daily;
  exception when sqlstate '55000' then refresh materialized view public.mv_portal_daily; end;

  begin refresh materialized view concurrently public.mv_user_daily;
  exception when sqlstate '55000' then refresh materialized view public.mv_user_daily; end;

  begin refresh materialized view concurrently public.mv_feature_usage_30d;
  exception when sqlstate '55000' then refresh materialized view public.mv_feature_usage_30d; end;

  begin refresh materialized view concurrently public.mv_department_daily;
  exception when sqlstate '55000' then refresh materialized view public.mv_department_daily; end;
end $$;

grant select on public.mv_department_daily to authenticated;
