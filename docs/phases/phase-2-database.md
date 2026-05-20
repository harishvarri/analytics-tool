# Phase 2 — Database & Analytics Engine

## What's in the box

| Migration | Purpose |
|---|---|
| `0001_extensions.sql` | `pgcrypto`, `pg_trgm`, `btree_gin` |
| `0002_core_schema.sql` | Enums, tables, indexes, triggers, RLS |
| `0003_aggregations.sql` | Realtime view + 3 materialized rollups |
| `seed.sql` | Idempotent portal registry seed |

## Tables

```
analytics_portals     ── registry (FK target for everything portal-scoped)
analytics_users       ── mirror of auth.users (FK target for events/sessions)
analytics_sessions    ── one row per portal session, event_count auto-bumped
analytics_events      ── partitioned by month on occurred_at
analytics_reports     ── saved/scheduled report specs (jsonb)
```

## Design decisions

1. **Partitioning** — `analytics_events` is `partition by range (occurred_at)`. Three rolling monthly partitions are seeded; `ensure_events_partition(date)` adds new ones on demand (call from a monthly cron in Phase 8). A `default` partition catches stragglers. Detaching an old partition is a constant-time archival operation.

2. **Composite PK** — `(id, occurred_at)`. Required because Postgres mandates the partition key be part of every unique constraint.

3. **Indexes** — btree on hot columns (`portal_id`, `user_id`, `category`, `occurred_at`); trigram GIN on `name` (for fast `ilike` autocomplete); `jsonb_path_ops` GIN on `metadata`; partial index on active sessions only.

4. **JSONB metadata** — every event carries `metadata jsonb`. Keep keys flat (≤2 levels) so the GIN index helps; nested blobs work but cost more.

5. **Triggers** —
   - `tg_mirror_auth_user` on `auth.users` keeps `analytics_users` in sync on signup.
   - `tg_bump_session_event_count` increments `event_count` + bumps `last_seen_at` after every insert into `analytics_events`.
   - `tg_touch_updated_at` is the shared "set updated_at = now()" tick.

6. **RLS posture** — every table is **deny by default**. Admins (rows in `analytics_users` with role in {`admin`,`owner`}) read everything. Regular users see only their own row. **The service role bypasses RLS** — that's how the ingestion API writes events. Never hand the service role key to the browser; it lives only in `SUPABASE_SERVICE_ROLE_KEY` (server-only env).

7. **Aggregations** — three materialized views (`mv_portal_daily`, `mv_user_daily`, `mv_feature_usage_30d`) plus one plain view (`v_realtime_activity`) for the live feed. `refresh_analytics_aggregates()` refreshes all MVs **concurrently** so dashboards never see a blank state.

## Refresh cadence (planned)

| View | Refresh |
|---|---|
| `v_realtime_activity` | n/a — plain view, always fresh |
| `mv_portal_daily` | every 5 min via cron |
| `mv_user_daily` | every 15 min via cron |
| `mv_feature_usage_30d` | hourly via cron |

(Phase 8 wires this up — either pg_cron extension or a Vercel cron hitting `/api/v1/admin/refresh-aggregates`.)

## Local development

```bash
# install once
npm i -g supabase
# from repo root
supabase start                    # boots Postgres + Studio + Realtime locally
supabase db reset                 # runs migrations + seed
```

Connection string for `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed by `supabase start`>
SUPABASE_SERVICE_ROLE_KEY=<printed by `supabase start`>
```

## Verification

```bash
# Confirm migrations apply cleanly
supabase db reset

# In Studio (http://localhost:54323) → SQL editor:
select * from analytics_portals;                         -- 6 rows
insert into analytics_events (portal_id, category, name) values
  ('training', 'feature', 'lesson.viewed');              -- should land in y2026m05
select count(*) from analytics_events;                   -- 1
select * from v_realtime_activity;                       -- 1 row
select public.refresh_analytics_aggregates();
select * from mv_portal_daily;                           -- 1 row for training/today
```

## What's not here (deferred)

- Phase 3 / 4: SDK + ingestion API actually writing into these tables.
- Phase 6: Supabase Realtime channel subscriptions on `analytics_events`.
- Phase 8: pg_cron schedule + partition rollover job.
