# Phase 8 — Production Hardening

Belt-and-suspenders pass over every layer. No new features — every change tightens what already exists.

## Security headers ([next.config.ts](apps/web/next.config.ts))

Applied to every response:

| Header | Value | Why |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS for 2 years |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME confusion |
| `X-Frame-Options` | `DENY` | No clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No URL leakage cross-origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables APIs the platform never needs |

Plus a CORS preflight allowance scoped to `/api/v1/events` only — every other route stays same-origin.

## Request tracing ([lib/api/handler.ts](apps/web/src/lib/api/handler.ts))

`withApiHandler` now mints (or echoes) `x-request-id` on every request. The id is stamped into the response and every log line, so client error reports can be correlated with server logs in one grep.

## Centralized runtime tunables ([config/runtime.ts](apps/web/src/config/runtime.ts))

Magic numbers (rate limits, payload caps, buffer sizes, partition lead months) moved into a single typed `RUNTIME` object. Edit once, applied everywhere.

## Ingestion guards

- **Max payload size**: `parseBody(..., { maxBytes: 64 KiB })` rejects oversized POSTs before parsing JSON.
- **Strict schemas**: `trackEventSchema` and `trackEventBatchSchema` now use Zod `.strict()`. Unknown fields → 400, not silently dropped.
- **Rate limit values** pulled from `RUNTIME.ingest` instead of hard-coded literals.

## Cron / maintenance routes

| Route | Verb | Auth | Purpose |
|---|---|---|---|
| `/api/v1/admin/refresh-aggregates` | POST | `x-cron-secret` | Calls `refresh_analytics_aggregates()` |
| `/api/v1/admin/ensure-partitions` | POST | `x-cron-secret` | Calls `ensure_events_partition()` for current + next N months |

Auth via `requireCronSecret()` — accepts `x-cron-secret` or `authorization: Bearer …`. Vercel Cron stamps the latter automatically.

`CRON_SECRET` added to env validation.

## SDK retry hardening ([packages/sdk/src/core/queue.ts](packages/sdk/src/core/queue.ts))

- **Exponential backoff with full jitter** (AWS-style). Previous `1000 * 2^n` is now `random(0, min(cap, 1000 * 2^n))` — prevents thundering-herd reconnects.
- **`onDrop` callback** on `AnalyticsClient` and `EventQueue`. Permanently dropped batches surface to a caller-supplied function so portals can wire them into Sentry / Datadog / their own dead-letter logging.

## Verification

```bash
npx tsc --noEmit && npx next lint && npx next build
# in packages/sdk:
npx tsup
```

All clean.

## What's NOT here (deferred to Phase 9 / future)

- Real WAF rules (Vercel / Cloudflare)
- CSP nonces (we ship security headers but not a Content-Security-Policy yet — needs the final inline-style/script inventory)
- pg_cron self-hosting alternative
- Persistent SDK queue (IndexedDB across reloads)
