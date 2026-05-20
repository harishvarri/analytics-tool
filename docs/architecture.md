# Architecture

## North Star

A single centralized analytics platform that every NCPL internal portal connects to via the **`@ncpl/analytics-sdk`**. All ingestion, storage, aggregation, and visualization happens here.

```
┌────────────────────────────┐
│  Internal Portals          │
│  (Training, PM, Resume…)   │
└─────────────┬──────────────┘
              │  events
              ▼
┌────────────────────────────┐
│  @ncpl/analytics-sdk       │  ← reusable, typed, transport+queue
└─────────────┬──────────────┘
              │  POST /api/v1/events
              ▼
┌────────────────────────────┐
│  Next.js API (apps/web)    │  ← validate · auth · normalize
└─────────────┬──────────────┘
              │  SQL / Realtime
              ▼
┌────────────────────────────┐
│  Supabase (Postgres)       │
│  events · sessions · …     │
└─────────────┬──────────────┘
              │  RLS · realtime channels
              ▼
┌────────────────────────────┐
│  Enterprise Dashboard      │
│  /dashboard (SSR + RQ)     │
└────────────────────────────┘
```

## Key Decisions

| # | Decision | Reasoning |
|---|---|---|
| 1 | npm workspaces (no turbo yet) | Simplicity now, room to grow. |
| 2 | App Router + route groups | Layout isolation without URL pollution. |
| 3 | Feature-sliced (`src/features/*`) | Prevents the catch-all `/components` swamp. |
| 4 | 3-tier Supabase clients (browser/server/admin) | Service-role key never reaches the client. |
| 5 | Standard API envelope `{ ok, data \| error }` | Predictable client handling; versioned under `/api/v1`. |
| 6 | Env validated by Zod at boot | Misconfig fails loud at import time. |
| 7 | Strict TS + `noUncheckedIndexedAccess` | Forces array/object access guards. |
| 8 | shadcn/ui with slate palette | Enterprise-neutral aesthetic; full source ownership. |
| 9 | Pino logger | Structured JSON in prod, pretty in dev. |

## Module Map

- **`lib/supabase`** — three clients + middleware refresh helper.
- **`lib/api`** — response envelope, error taxonomy, handler wrapper, Zod validation helpers.
- **`lib/env`** — single source of truth for runtime configuration.
- **`lib/logger`** — request-scoped child loggers.
- **`config/*`** — declarative metadata (nav, portals, analytics names).
- **`constants/*`** — invariants (routes, API paths).
- **`types/*`** — domain types + generated DB types.
- **`features/*`** — vertical slices for each analytics surface.

See [`naming-conventions.md`](naming-conventions.md).
