# Training Portal — Analytics Integration

Reference integration for a **Next.js 15 App Router** portal.

## Files

| Path | What it does |
|---|---|
| [`src/lib/analytics.ts`](src/lib/analytics.ts) | Module-scope `AnalyticsClient` + domain-specific track helpers |
| [`src/app/providers.tsx`](src/app/providers.tsx) | Mounts `AnalyticsProvider`, identifies the user, tracks pageviews on route changes |
| [`src/app/layout.tsx`](src/app/layout.tsx) | Server-resolves the user, hands off to `Providers` |
| [`src/app/lessons/[id]/page.tsx`](src/app/lessons/[id]/page.tsx) | Feature component using domain helpers (no raw SDK calls) |
| [`src/components/ErrorBoundary.tsx`](src/components/ErrorBoundary.tsx) | Captures client-side errors → `analytics.trackError()` |

## Env (`.env.local`)

```
NEXT_PUBLIC_ANALYTICS_ENDPOINT=https://analytics.ncpl.internal/api/v1/events
NEXT_PUBLIC_ANALYTICS_KEY=…   # only if portal sends the key from the browser
NEXT_PUBLIC_RELEASE_SHA=$(git rev-parse --short HEAD)
```

## Patterns demonstrated

1. **One client, many call sites.** A singleton in `lib/analytics.ts` is the only `new AnalyticsClient(...)` call in the whole portal.
2. **Domain helpers, not raw events.** Feature code calls `trackLessonViewed(42)`, never `track({ category: 'feature', name: 'lesson.viewed', ... })`. Refactoring an event name is a one-line change.
3. **Identify on session.** `Providers` calls `a.identify(user.id)` on auth changes; `a.reset()` on logout flushes the user + session IDs.
4. **Route-change pageviews.** `usePathname()` + `useEffect` → `trackPageView`. Works for soft navigations.
5. **Error boundary forwarding.** Component stack travels in metadata for triage.
6. **Build/release tagging.** `defaults: { release: ..., env: ... }` attaches build info to every event without per-call boilerplate.
