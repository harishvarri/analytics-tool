-- =============================================================================
-- Migration 0027 — Event importance (server-derived classification)
-- =============================================================================
-- Adds a 4-tier importance signal to every event WITHOUT requiring any change
-- to the 80 client apps. Classification is rule-based and centrally tunable.
--
--   Tiers (highest → lowest business value):
--     business_critical  — auth, money, documents, entity create/complete.
--                          Kept forever (archived before partitions drop, 0028).
--     important          — errors and other ops-relevant signals.
--     normal             — interactions, feature use, route changes.
--     debug              — page views, performance/diagnostics (feed noise).
--
-- The tier is stamped into metadata->>'_importance' at ingest time (app mirror
-- in lib/importance.ts) AND backfilled here for existing rows. This SQL function
-- remains the source of truth for backfills and the retention job (0028).
-- =============================================================================

-- ── Rules table ──────────────────────────────────────────────────────────────
-- A rule matches when category matches (or is NULL = any) AND the event name is
-- LIKE name_like (SQL wildcards). Highest `priority` wins; ties broken by the
-- most specific (longest) pattern. Default tier when nothing matches: 'normal'.
create table if not exists public.analytics_event_importance_rules (
  id         bigint generated always as identity primary key,
  category   public.event_category,          -- null = applies to any category
  name_like  text not null default '%',      -- SQL LIKE pattern against event name
  tier       text not null check (tier in ('business_critical','important','normal','debug')),
  priority   int  not null default 100,
  note       text
);

-- Seed defaults (idempotent: only seed when the table is empty).
insert into public.analytics_event_importance_rules (category, name_like, tier, priority, note)
select * from (values
  -- ── business_critical (kept forever) ───────────────────────────────────────
  ('auth'::public.event_category,   'auth.login',         'business_critical', 900, 'sign-in'),
  ('auth'::public.event_category,   'auth.logout',        'business_critical', 900, 'sign-out'),
  ('auth'::public.event_category,   'auth.signup',        'business_critical', 900, 'account created'),
  (null,                            '%.created',          'business_critical', 800, 'entity creation'),
  (null,                            '%.completed',        'business_critical', 800, 'completion'),
  (null,                            '%.submitted',        'business_critical', 780, 'submission'),
  (null,                            'payment.%',          'business_critical', 850, 'money movement'),
  (null,                            '%.generated',        'business_critical', 760, 'document/report generated'),
  (null,                            'candidate.%',        'business_critical', 740, 'recruitment'),
  (null,                            'interview.%',        'business_critical', 740, 'recruitment'),
  (null,                            'attendance.%',       'business_critical', 720, 'attendance'),
  -- ── important (ops-relevant) ───────────────────────────────────────────────
  ('error'::public.event_category,  '%',                  'important',         600, 'all errors'),
  (null,                            '%.failed',           'important',         620, 'failures'),
  (null,                            '%.deleted',          'important',         580, 'deletions'),
  -- ── debug (feed noise, ages out fast) ──────────────────────────────────────
  ('navigation'::public.event_category, 'navigation.page_view',     'debug', 300, 'page view noise'),
  ('navigation'::public.event_category, 'navigation.time_on_page',  'debug', 300, 'dwell noise'),
  (null,                            'performance.%',      'debug',             250, 'perf diagnostics'),
  -- ── normal (default-ish for the common middle) ─────────────────────────────
  ('navigation'::public.event_category, '%',              'normal',            120, 'other navigation'),
  ('interaction'::public.event_category, '%',             'normal',            120, 'interactions'),
  ('feature'::public.event_category, '%',                 'normal',            120, 'feature use'),
  (null,                            '%',                  'normal',            10,  'catch-all default')
) as seed(category, name_like, tier, priority, note)
where not exists (select 1 from public.analytics_event_importance_rules);

-- ── Classifier function ──────────────────────────────────────────────────────
-- Returns the tier for a (category, name) pair. STABLE so it can be used in
-- generated expressions / backfills efficiently.
create or replace function public.classify_importance(p_category public.event_category, p_name text)
returns text language sql stable as $$
  select r.tier
  from public.analytics_event_importance_rules r
  where (r.category is null or r.category = p_category)
    and p_name like r.name_like
  order by r.priority desc, length(r.name_like) desc
  limit 1;
$$;

-- ── Backfill existing events ─────────────────────────────────────────────────
-- Stamp metadata->>'_importance' for rows that don't have it yet. Batched
-- implicitly by partition pruning on occurred_at is unnecessary here because
-- this runs once at migration time; on very large datasets re-run per partition.
update public.analytics_events
set metadata = metadata || jsonb_build_object('_importance', public.classify_importance(category, name))
where not (metadata ? '_importance');

-- ── Index for fast feed / retention filtering ────────────────────────────────
create index if not exists analytics_events_importance_idx
  on public.analytics_events ((metadata->>'_importance'));

-- ── Grants ────────────────────────────────────────────────────────────────────
grant select on public.analytics_event_importance_rules to authenticated;
