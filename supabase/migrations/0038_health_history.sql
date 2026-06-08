-- =============================================================================
-- Migration 0038 — Health History (reliability score evolution over time)
-- =============================================================================
-- Stores one row per product per day so the Health system can show real
-- Daily / Weekly / Monthly trends and a "Health Evolution" chart.
--
-- The reliability score is computed in the application layer (TypeScript), so
-- this table is pure storage. It is populated idempotently by
-- snapshotReliabilityHealth():
--   • opportunistically when the Health dashboard is viewed (via Next.js after())
--   • and/or by a daily Vercel Cron hitting /api/v1/admin/snapshot-health
-- The (snapshot_date, project_slug) primary key makes re-running a day a no-op
-- overwrite, so multiple snapshots per day simply keep the latest value.
-- =============================================================================

create table if not exists public.health_history (
  snapshot_date     date    not null,
  project_slug      text    not null,
  score             integer not null,
  status            text    not null check (status in ('healthy', 'warning', 'critical')),
  total_penalty     integer not null default 0,
  affected_users    integer not null default 0,
  affected_sessions integer not null default 0,
  active_incidents  integer not null default 0,
  breakdown         jsonb,
  created_at        timestamptz not null default now(),
  primary key (snapshot_date, project_slug)
);

create index if not exists health_history_slug_date_idx
  on public.health_history (project_slug, snapshot_date desc);

grant select, insert, update on public.health_history to authenticated, service_role;
