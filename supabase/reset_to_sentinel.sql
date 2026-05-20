-- ============================================================================
-- reset_to_sentinel.sql
--
-- PURPOSE : Wipe all demo data and set up the database for the Sentinel
--           project only. Run this once in the Supabase SQL Editor.
--
-- HOW TO RUN :
--   Supabase Dashboard → SQL Editor → paste this file → Run
--
-- SAFE TO RUN : Yes. It only deletes rows and adds an enum value.
--               It never drops tables, columns, or functions.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Add 'sentinel' to the portal_id enum
--
-- PostgreSQL cannot remove enum values, only add them.
-- The old values (training, project-management, etc.) will remain in the
-- enum definition but will have zero rows — they are harmless dead values.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.portal_id ADD VALUE IF NOT EXISTS 'sentinel';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Wipe all existing rows from every data table
-- ─────────────────────────────────────────────────────────────────────────────

-- Events (partitioned table — TRUNCATE hits parent + all partitions)
TRUNCATE TABLE public.analytics_events   CASCADE;

-- Sessions
TRUNCATE TABLE public.analytics_sessions CASCADE;

-- Users (analytics mirror — does NOT touch auth.users)
TRUNCATE TABLE public.analytics_users    CASCADE;

-- Reports
TRUNCATE TABLE public.analytics_reports  CASCADE;

-- Portals (we re-seed below)
TRUNCATE TABLE public.analytics_portals  CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Seed the two real portals
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.analytics_portals (id, name, description, color, is_active)
VALUES
  ('sentinel',  'Sentinel',           'Internal Sentinel project',      'violet', true),
  ('analytics', 'Analytics Platform', 'This platform (self-reporting)', 'slate',  true)
ON CONFLICT (id) DO UPDATE SET
  name        = excluded.name,
  description = excluded.description,
  color       = excluded.color,
  is_active   = excluded.is_active;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Refresh materialized views so they reflect the clean state
-- (They will be empty — that is correct until real events arrive)
-- ─────────────────────────────────────────────────────────────────────────────

REFRESH MATERIALIZED VIEW public.mv_portal_daily;
REFRESH MATERIALIZED VIEW public.mv_user_daily;
REFRESH MATERIALIZED VIEW public.mv_feature_usage_30d;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — Run this SELECT to confirm the reset worked
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  id,
  name,
  color,
  is_active
FROM public.analytics_portals
ORDER BY id;

/*
  Expected result:
  ┌───────────┬──────────────────────┬────────┬───────────┐
  │ id        │ name                 │ color  │ is_active │
  ├───────────┼──────────────────────┼────────┼───────────┤
  │ analytics │ Analytics Platform   │ slate  │ true      │
  │ sentinel  │ Sentinel             │ violet │ true      │
  └───────────┴──────────────────────┴────────┴───────────┘
*/
