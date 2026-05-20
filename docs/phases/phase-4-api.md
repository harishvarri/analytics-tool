# Phase 4 — Backend Analytics API

## Surface

All endpoints under `/api/v1`. Standard envelope: `{ ok: true, data } | { ok: false, error: { code, message, details? } }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/health` | none | Liveness probe |
| POST | `/events` | `x-ncpl-api-key` | Bulk event ingestion (SDK target) |
| GET  | `/realtime` | admin session | Last 5 min of activity |
| GET  | `/analytics/dashboard` | admin session | 24h KPI tiles |
| GET  | `/analytics/portals` | admin session | Per-portal 24h summary |
| GET  | `/analytics/users?limit=` | admin session | Top users today |
| GET  | `/analytics/sessions?limit=` | admin session | Recent sessions |

## Auth model

Two distinct trust paths:

1. **Ingestion** — `POST /events` is called by *portal SDKs running in users' browsers*. We can't ask the browser for a Supabase JWT, so we use a **shared API key** (`INGEST_API_KEY`) stamped on `x-ncpl-api-key`. Constant-time-ish comparison via `safeEqual`. Server-only.

2. **Read APIs** — every other endpoint requires an authenticated Supabase session with the `is_analytics_admin()` RPC returning true. Enforced by `requireAdmin()` in [lib/api/auth.ts](apps/web/src/lib/api/auth.ts:32).

The **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) is used for the actual SQL — RLS is bypassed by ingestion (writes events) and by the read repositories (so admins see across the org). The browser never sees this key.

## Architecture

```
Route handler  (apps/web/src/app/api/v1/**/route.ts)
   └─ withApiHandler()        ← centralized error catch + log + envelope
        └─ requireIngestKey() / requireAdmin()
        └─ rateLimit()         ← in-memory token bucket
        └─ parseBody/Query()   ← Zod validation
        └─ Repository fn       ← apps/web/src/lib/repositories/*
              └─ Supabase service-role client
```

The **repository layer** isolates every SQL query. Route handlers contain *no* Supabase code. This makes them trivially mockable in tests, lets us swap the storage backend without touching handlers, and keeps camelCase→snake_case mapping in exactly one place.

## Event ingestion details

- Validated by [trackEventBatchSchema](apps/web/src/lib/schemas/events.ts:38) — same Zod schema the SDK imports for compile-time typing.
- Batches up to **50 events** per request (`MAX_EVENT_BATCH_SIZE` in [constants/api.ts](apps/web/src/constants/api.ts)).
- For each batch we **upsert sessions first** (`ignoreDuplicates: true` so it's a no-op for existing ones), then bulk-insert events. The per-event trigger handles `event_count` / `last_seen_at`.
- Client IP is **SHA-256 hashed with `IP_HASH_SALT`** before storage. No raw IP ever lands in the database.
- Rate limit: **100/s burst, 50/s sustained** per IP. Best-effort in-memory — pair with Vercel WAF for hardened prod.

## Read query optimization

- KPIs use **`count: 'exact', head: true`** Supabase queries to avoid pulling rows just to count them.
- Per-portal and per-user dashboards read from **materialized views** (`mv_portal_daily`, `mv_user_daily`) so the query cost stays flat as the events table grows.
- Realtime feed reads the **plain view** `v_realtime_activity` which already filters to `> now() - interval '5 minutes'` and joins portal+user metadata.

## Error model

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod schema failed |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | Not an admin |
| `RATE_LIMIT` | 429 | Bucket empty |
| `INGEST_FAILED` / `*_QUERY_FAILED` | 500 | DB layer error |
| `INTERNAL_ERROR` | 500 | Unhandled |

All errors flow through `withApiHandler` → logged with route + method + status + ms.

## Smoke test (manual, against local Supabase)

```bash
# Ingest one event
curl -X POST http://localhost:3000/api/v1/events \
  -H "content-type: application/json" \
  -H "x-ncpl-api-key: $INGEST_API_KEY" \
  -d '{"events":[{"portalId":"training","category":"feature","name":"lesson.viewed","metadata":{"lessonId":42}}]}'
# → { "ok": true, "data": { "inserted": 1 } }

# Read realtime (requires admin session cookie)
curl http://localhost:3000/api/v1/realtime --cookie cookies.txt
```
