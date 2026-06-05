-- =============================================================================
-- Migration 0024 — Blocks 4–6: reliability/performance views, retention views,
--                  analytics_users columns, and helper functions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 4A — error_fingerprint() + v_error_groups
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.error_fingerprint(p_message text, p_stack text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT md5(
    regexp_replace(coalesce(p_message,''), '\d+', 'N', 'g') || '||' ||
    regexp_replace(coalesce(split_part(p_stack, E'\n', 1),''), '\d+', 'N', 'g')
  );
$$;

-- Drop dependent view first, then base view
DROP VIEW IF EXISTS public.v_reliability_kpis CASCADE;
DROP VIEW IF EXISTS public.v_error_groups CASCADE;

CREATE OR REPLACE VIEW public.v_error_groups AS
SELECT
  error_fingerprint(
    (metadata->>'message'),
    (metadata->>'stack')
  )                                                         AS fingerprint,
  (metadata->>'message')                                    AS message,
  split_part(coalesce(metadata->>'stack',''), E'\n', 1)     AS top_frame,
  portal_id,
  COUNT(*)                                                  AS occurrences,
  COUNT(DISTINCT user_id)                                   AS affected_users,
  MIN(occurred_at)                                          AS first_seen,
  MAX(occurred_at)                                          AS last_seen,
  MIN(occurred_at) >= NOW() - INTERVAL '24 hours'           AS is_new,
  MAX(occurred_at) >= NOW() - INTERVAL '1 hour'             AS is_active
FROM public.analytics_events
WHERE category = 'error'
GROUP BY 1,2,3,4;

-- ---------------------------------------------------------------------------
-- BLOCK 4B — v_reliability_kpis
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_reliability_kpis AS
SELECT
  portal_id,
  COUNT(*) FILTER (WHERE category = 'error')                              AS errors_24h,
  COUNT(*) FILTER (WHERE category = 'error'
                     AND occurred_at >= NOW() - INTERVAL '1 hour')        AS errors_1h,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE category = 'error') /
    NULLIF(COUNT(*), 0), 2
  )                                                                        AS error_rate_pct,
  (SELECT count(*) FROM public.v_error_groups WHERE is_new)               AS new_error_groups_24h
FROM public.analytics_events
WHERE occurred_at >= NOW() - INTERVAL '24 hours'
GROUP BY portal_id;

-- BLOCK 4C — Performance views already defined in migration 0018 (page-load metrics).
-- No changes needed here.

-- ---------------------------------------------------------------------------
-- BLOCK 5 — Retention & user profile views
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_user_app_profile CASCADE;
DROP VIEW IF EXISTS public.v_user_profile_summary CASCADE;

CREATE OR REPLACE VIEW public.v_user_app_profile AS
SELECT
  e.user_id,
  e.portal_id                                              AS project_slug,
  u.email,
  u.display_name,
  u.department,
  u.team,
  MIN(e.occurred_at)                                       AS first_seen_at,
  MAX(e.occurred_at)                                       AS last_active_at,
  COUNT(*)                                                 AS total_events,
  COUNT(DISTINCT s.id)                                     AS total_sessions
FROM public.analytics_events e
LEFT JOIN public.analytics_users u  ON u.id = e.user_id
LEFT JOIN public.analytics_sessions s ON s.user_id = e.user_id
                                      AND s.portal_id = e.portal_id
GROUP BY e.user_id, e.portal_id, u.email, u.display_name, u.department, u.team;

CREATE OR REPLACE VIEW public.v_user_profile_summary AS
SELECT
  u.id                                                     AS user_id,
  u.email,
  u.display_name,
  u.department,
  u.team,
  COALESCE(u.status, 'active')                             AS status,
  COUNT(DISTINCT e.portal_id)                              AS apps_used,
  COUNT(e.id)                                              AS total_events,
  COUNT(DISTINCT s.id)                                     AS total_sessions,
  MIN(e.occurred_at)                                       AS first_seen_at,
  MAX(e.occurred_at)                                       AS last_active_at
FROM public.analytics_users u
LEFT JOIN public.analytics_events  e ON e.user_id = u.id
LEFT JOIN public.analytics_sessions s ON s.user_id = u.id
GROUP BY u.id, u.email, u.display_name, u.department, u.team, u.status;

-- ---------------------------------------------------------------------------
-- BLOCK 6 — analytics_users columns + helper functions
-- ---------------------------------------------------------------------------

ALTER TABLE public.analytics_users
  ADD COLUMN IF NOT EXISTS department   text,
  ADD COLUMN IF NOT EXISTS team         text,
  ADD COLUMN IF NOT EXISTS title        text,
  ADD COLUMN IF NOT EXISTS source       text,
  ADD COLUMN IF NOT EXISTS is_internal  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status       text    DEFAULT 'active';

CREATE OR REPLACE FUNCTION public.upsert_user_by_email(
  p_email        text,
  p_display_name text DEFAULT NULL,
  p_department   text DEFAULT NULL,
  p_team         text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.analytics_users (id, email, display_name, department, team)
  VALUES (gen_random_uuid(), p_email, p_display_name, p_department, p_team)
  ON CONFLICT (email) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, analytics_users.display_name),
        department   = COALESCE(EXCLUDED.department,   analytics_users.department),
        team         = COALESCE(EXCLUDED.team,         analytics_users.team),
        updated_at   = NOW()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_active_portals_today(p_since timestamptz DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COUNT(DISTINCT portal_id)
  FROM public.analytics_events
  WHERE occurred_at >= COALESCE(p_since, DATE_TRUNC('day', NOW()));
$$;

CREATE OR REPLACE FUNCTION public.create_project_atomic(
  p_slug         text,
  p_name         text,
  p_description  text    DEFAULT NULL,
  p_repo_url     text    DEFAULT NULL,
  p_vercel_url   text    DEFAULT NULL,
  p_environment  text    DEFAULT 'production',
  p_project_type text    DEFAULT 'web',
  p_team_owner   text    DEFAULT NULL,
  p_tracking     boolean DEFAULT true,
  p_api_key      text    DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.analytics_portals (id, name)
  VALUES (p_slug, p_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.analytics_projects (
    slug, name, description, repo_url, vercel_url,
    environment, project_type, team_owner, tracking_enabled, api_key
  ) VALUES (
    p_slug, p_name, p_description, p_repo_url, p_vercel_url,
    p_environment, p_project_type, p_team_owner, p_tracking,
    COALESCE(p_api_key, 'ncpl_pk_' || encode(gen_random_bytes(24), 'base64'))
  )
  ON CONFLICT (slug) DO NOTHING;
END;
$$;
