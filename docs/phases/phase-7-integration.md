# Phase 7 — Internal Portal Integration

Phase 7 produces **reference integrations** — not full portal rewrites. The goal is to give every internal team a copy-pasteable starting point that matches their stack.

## Deliverables

Everything in [`examples/`](examples/):

- [`training-portal`](examples/training-portal) — Next.js App Router
- [`project-management-portal`](examples/project-management-portal) — Vite + React Router SPA
- [`resume-marketing-portal`](examples/resume-marketing-portal) — Vanilla JS / `<script>` tag
- [`server-side`](examples/server-side) — Node cron + webhook handlers
- [`README.md`](examples/README.md) — Universal patterns guide (taxonomy, lifecycle, deployment models, gotchas)

## What every integration enforces

1. **Singleton SDK instance.** One `new AnalyticsClient(...)` per portal, at module scope.
2. **Domain helpers, not raw events.** `trackLessonViewed(42)`, never `track({ category: 'feature', name: 'lesson.viewed', ... })`.
3. **`identify` / `reset` on auth state changes.** Once per change.
4. **`source` field set explicitly on server events.** `'web'` is the default the SDK fills; server callers stamp `'server'` or `'integration'`.
5. **`defaults` for release/env/service tags.** Never per-call.
6. **Flush on shutdown.** Browser handled by SDK; Node services hook `beforeExit` / `SIGTERM`.

## Deployment model recommendations

| Portal | Recommended model |
|---|---|
| Internal-only, behind VPN | **No-key + CORS** — simplest |
| Mixed access, soft secrets OK | **Direct API key** in the browser |
| Sensitive deployments | **Proxy** through portal's own backend |

The platform supports all three — `INGEST_API_KEY` is optional on the server side.

## Next steps for each portal team

1. Choose the closest example and copy `analytics.{ts,js}` into your codebase.
2. Rename the domain helpers (`trackLessonViewed` → your-domain).
3. Add `<AnalyticsProvider>` or its equivalent at the root.
4. Mount one route-change → `trackPageView` listener.
5. Replace ad-hoc tracking calls with the domain helpers.
6. Verify events land via [`/dashboard/realtime`](apps/web/src/app/(dashboard)/dashboard/realtime/page.tsx).
