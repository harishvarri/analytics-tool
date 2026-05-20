# Phase 6 — Realtime Analytics Engine

## What ships

- [0004_realtime.sql](supabase/migrations/0004_realtime.sql) — adds `analytics_events` + `analytics_sessions` to `supabase_realtime` publication; sets `REPLICA IDENTITY FULL` so payloads include the full row.
- [features/realtime-feed/](apps/web/src/features/realtime-feed) — self-contained feature slice:
  - [use-realtime-activity.ts](apps/web/src/features/realtime-feed/use-realtime-activity.ts) — subscribes to `postgres_changes`, throttled rolling buffer.
  - [use-live-counters.ts](apps/web/src/features/realtime-feed/use-live-counters.ts) — derives active users/sessions/EPM from the buffer.
  - [map.ts](apps/web/src/features/realtime-feed/map.ts) — DB row → UI activity item conversion.
  - [components/ConnectionPill.tsx](apps/web/src/features/realtime-feed/components/ConnectionPill.tsx) — color-coded channel state with pulse.
  - [components/LiveCounters.tsx](apps/web/src/features/realtime-feed/components/LiveCounters.tsx) — three live KPI tiles.
  - [components/RealtimeFeed.tsx](apps/web/src/features/realtime-feed/components/RealtimeFeed.tsx) — composite that pairs counters + activity stream.
- [/dashboard/realtime](apps/web/src/app/(dashboard)/dashboard/realtime/page.tsx) — server-renders 40 initial events for instant first paint, then hands off to the client subscription.

## Architecture

```
SQL ──────────────────────┐
  analytics_events INSERT │
       │                  │
       ▼                  │
  Realtime publication    │  (RLS still applies — only admins receive)
       │
       ▼
  Browser channel  ────►  useRealtimeActivity()
       │                       │
       │                       ├─ pendingRef (staging buffer)
       │                       └─ flushInterval (400ms tick)
       ▼                       │
  Throttled state ─────────────┘
       │
       ├─ <ActivityFeed items=… />
       └─ useLiveCounters(items) → <LiveCounters />
```

## Design decisions

1. **Server-rendered first paint.** The page Server Component fetches the most-recent 40 events via the existing repository (with mock fallback). The realtime hook seeds its buffer with that array, so users never see an empty state while the WebSocket connects.

2. **Throttled rendering.** Incoming payloads go to a ref-staged queue. A single `setInterval(flush, 400ms)` commits batches into React state. This means at 1000 events/sec the dashboard rerenders ~2.5×/sec, not 1000×.

3. **Rolling capacity.** `capacity = 60` (page-configurable) caps the in-memory buffer. Old events fall off; the live counters auto-shrink with them.

4. **Tab-pause.** Subscription pauses on `visibilitychange` → `hidden`. No traffic, no buffer growth, no battery drain.

5. **`REPLICA IDENTITY FULL`.** Postgres' default replica identity is the primary key only — Supabase Realtime would deliver `{ id }` and nothing else. `FULL` is required for our activity-feed payloads.

6. **RLS still applies.** The browser subscribes with the anon key + authenticated session. Only rows visible under RLS reach the client. That means non-admin users get nothing — correct posture.

7. **Connection state surfaced.** `ConnectionPill` shows `connecting / open / closed / error` with a pulse on `open`. Operators always know if they're looking at a live feed or a stale one.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx next lint` | no warnings or errors |
| `npx next build` | 14 routes, success — `/dashboard/realtime` first-load 195 kB |

End-to-end smoke test (needs Supabase):
```sql
-- After applying 0001-0004 + running the seed:
insert into public.analytics_events (portal_id, category, name)
values ('training', 'feature', 'lesson.viewed');
-- → row appears at the top of /dashboard/realtime within ~400ms
```
