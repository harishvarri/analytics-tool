# Server-Side Integration

Reference integration for **Node services, cron jobs, and webhook handlers** that emit events server-side.

## Files

| Path | What it does |
|---|---|
| [`src/analytics.ts`](src/analytics.ts) | Singleton with required env validation, graceful shutdown flush |
| [`src/cron-daily-reminder.ts`](src/cron-daily-reminder.ts) | Cron job emitting per-reminder + summary events |
| [`src/webhook-handler.ts`](src/webhook-handler.ts) | Express handler emitting `source: 'integration'` events |

## Patterns

1. **`source: 'server' | 'integration'`** — pass explicitly so the dashboard can split machine-generated traffic from user actions.
2. **`apiKey` always set** — server processes have the shared secret. Without it, the ingestion endpoint rejects.
3. **Flush on shutdown** — `beforeExit` + `SIGTERM` handlers flush the queue before the process dies. Cron jobs should `await analytics.flush()` at the end of their main function for the same reason.
4. **No `userId` from auth headers** — pass it explicitly per event from your trusted server-side context. Never trust a client-supplied userId for server events.
5. **`trackError` in every catch block** — server errors become analytics events too, so error rate dashboards aggregate everything.

## Env (`.env`)

```
ANALYTICS_ENDPOINT=https://analytics.ncpl.internal/api/v1/events
ANALYTICS_API_KEY=$INGEST_API_KEY            # the platform's shared secret
SERVICE_NAME=jobs-worker
RELEASE_SHA=$(git rev-parse --short HEAD)
```
