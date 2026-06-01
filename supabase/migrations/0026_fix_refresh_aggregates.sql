-- =============================================================================
-- Migration 0026 — Fix refresh_analytics_aggregates() for empty MVs
-- =============================================================================
-- Root cause of HTTP 500 in the GitHub Actions cron job:
--
--   All three materialized views in migration 0003 were created WITH NO DATA.
--   PostgreSQL forbids REFRESH MATERIALIZED VIEW CONCURRENTLY on a view that
--   has never been populated — it has no snapshot to swap against.
--   So the very first call to refresh_analytics_aggregates() threw:
--     "cannot refresh materialized view concurrently because it has no data"
--   Supabase surfaced this as an RPC error, the route threw AppError 500.
--
-- Fix A (this migration):
--   1. Replace refresh_analytics_aggregates() with a self-healing version that
--      tries CONCURRENTLY and catches the empty-MV error, falling back to a
--      plain (blocking) REFRESH.  After the first plain refresh the view is
--      populated and CONCURRENTLY succeeds forever.
--   2. Immediately do the initial plain REFRESH for all three MVs right here,
--      so the cron job starts working the moment this migration is applied.
--
-- Fix B (already done in 0003_aggregations.sql for future fresh installs):
--   Initial REFRESH statements were added after the unique index creation
--   blocks, so new databases are pre-populated from day one.
-- =============================================================================

-- ── Step 1: Self-healing refresh function ────────────────────────────────────
-- Tries CONCURRENTLY (non-blocking for live dashboards).
-- If the MV is empty (PostgreSQL code 55000 / "no data"), falls back to a
-- plain REFRESH which populates it.  All subsequent calls use CONCURRENTLY.
CREATE OR REPLACE FUNCTION public.refresh_analytics_aggregates()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- mv_portal_daily
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_portal_daily;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    -- First-run fallback: view has no data yet, CONCURRENTLY is not allowed.
    REFRESH MATERIALIZED VIEW public.mv_portal_daily;
  END;

  -- mv_user_daily
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_user_daily;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    REFRESH MATERIALIZED VIEW public.mv_user_daily;
  END;

  -- mv_feature_usage_30d
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_feature_usage_30d;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    REFRESH MATERIALIZED VIEW public.mv_feature_usage_30d;
  END;
END;
$$;

-- ── Step 2: Initial populate of all three MVs ────────────────────────────────
-- Runs non-concurrently once, right now.  After this, CONCURRENTLY works.
-- Safe to re-run (REFRESH is always idempotent).
REFRESH MATERIALIZED VIEW public.mv_portal_daily;
REFRESH MATERIALIZED VIEW public.mv_user_daily;
REFRESH MATERIALIZED VIEW public.mv_feature_usage_30d;
