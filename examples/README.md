# Portal Integration Examples

Four reference integrations for the NCPL Analytics platform. Pick the closest fit, copy the files into your portal, and rename event helpers to match your domain.

| Example | Stack | Best for |
|---|---|---|
| [training-portal](training-portal) | Next.js 15 App Router | Modern SSR portals |
| [project-management-portal](project-management-portal) | Vite + React + React Router | SPA portals |
| [resume-marketing-portal](resume-marketing-portal) | Vanilla JS, `<script>` tag | Legacy / non-bundled portals |
| [server-side](server-side) | Node / Express / cron | Cron jobs, webhooks, server-only events |

## Universal patterns (apply to every portal)

### 1. One client, many call sites

Construct `new AnalyticsClient(...)` exactly **once** at module scope. Re-export wrapper helpers (`trackLessonViewed`, `trackProjectCreated`, …) so feature code never types raw event names.

```ts
// lib/analytics.ts
export const analytics = new AnalyticsClient({ portalId: 'training', endpoint: ENV.ENDPOINT });
export const trackLessonViewed = (id: number) => analytics.trackFeatureUsage('lesson.viewed', { lessonId: id });
```

```tsx
// feature.tsx
import { trackLessonViewed } from '@/lib/analytics';
trackLessonViewed(42); // refactor-safe; event name lives in exactly one place
```

### 2. Event naming taxonomy

Dot-namespaced lowercase: `<domain>.<action>` or `<domain>.<object>_<verb>`.

| Pattern | Example |
|---|---|
| User action | `lesson.viewed`, `task.moved`, `resume.submitted` |
| State transition | `application.offered`, `lesson.completed` |
| Server event | `reminder.sent`, `job.daily_reminder.completed` |
| Error | `error.captured` (use `trackError`) |

Reserved category prefixes: `auth.*`, `navigation.*`, `interaction.*`, `feature.*`, `error.*`. Custom events go through `trackCustomEvent` and are categorized `custom`.

### 3. Identify lifecycle

```ts
analytics.identify(user.id);  // on login / session restore
analytics.reset();            // on logout — clears userId + rotates sessionId
```

Identify exactly once per auth state change. Don't call it on every render.

### 4. Don't ship the API key to the browser if you can avoid it

The platform's `INGEST_API_KEY` is a server-side secret. Three deployment models:

| Model | Where the key lives | Trade-off |
|---|---|---|
| **Direct** (default) | Set on the client via `apiKey:` | Simplest. Use when the key is treated as a soft-secret. |
| **Proxy** | Portal's own backend proxies `/api/v1/events` and stamps the key | Hardest secret, but adds a hop per event |
| **None** | `INGEST_API_KEY` unset on the platform; CORS/origin checks only | OK for fully-internal deployments behind a VPN |

### 5. Defaults instead of per-call metadata

Anything that's true for every event (release SHA, env, service name) goes into the constructor's `defaults`. Feature code stays clean.

### 6. Server vs. client events

Stamp `source: 'server' | 'integration'` on every server-side event. The dashboard splits these from `source: 'web'` so reports can compare user vs. machine traffic.

### 7. Flush on shutdown

Browser: the SDK already binds `pagehide` / `visibilitychange` for sendBeacon.
Server: add `process.on('beforeExit'/'SIGTERM', () => analytics.flush())` in every long-running service.

## Common gotchas

- **Double tracking on Strict Mode mounts** — wrap page-view tracking in a useEffect with the path as dep; React 18 dev double-invocations only re-fire when deps change.
- **PII in `metadata`** — assume every key may end up in dashboards and exports. Don't pass raw emails, IPs, or freeform user input. Hash or omit.
- **Event name typos diverge silently** — that's why domain helpers exist. Always go through them, never inline strings.
- **Long batches under bursty load** — bump `batchSize` (default 20) and `flushIntervalMs` (default 5000) on portals that emit hundreds of events per minute.
