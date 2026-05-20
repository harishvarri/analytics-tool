# @ncpl/analytics-sdk

Reusable, typed event tracking for every NCPL internal portal.

- Tiny (~3 KB gz core), zero runtime deps
- Strongly typed events
- Batched HTTP transport with retry + `sendBeacon` on unload
- Per-tab session management
- Optional React provider + hooks
- Works in Node and the browser

## Install (inside the monorepo)

```ts
// package.json
"dependencies": { "@ncpl/analytics-sdk": "*" }
```

## Plain usage

```ts
import { AnalyticsClient } from '@ncpl/analytics-sdk';

export const analytics = new AnalyticsClient({
  portalId: 'training',
  endpoint: 'https://analytics.ncpl.internal/api/v1/events',
  debug: process.env.NODE_ENV !== 'production',
});

analytics.trackLogin(user.id);
analytics.trackPageView('/lessons/42');
analytics.trackFeatureUsage('lesson.video_play', { lessonId: 42 });
analytics.trackButtonClick('save-progress');
analytics.trackError(new Error('boom'));
analytics.trackCustomEvent('lesson.completed', { lessonId: 42, score: 0.92 });
analytics.trackLogout();
```

## React usage

```tsx
import { AnalyticsProvider, useAnalytics, useTrackPageView } from '@ncpl/analytics-sdk/react';
import { usePathname } from 'next/navigation';

function App() {
  return (
    <AnalyticsProvider portalId="training" endpoint="/api/v1/events">
      <Routes />
    </AnalyticsProvider>
  );
}

function Page() {
  useTrackPageView(usePathname());
  const a = useAnalytics();
  return <button onClick={() => a.trackButtonClick('cta-hero')}>Start</button>;
}
```

## Options

| Option | Default | Notes |
|---|---|---|
| `portalId` | — | Required. One of the registered portals. |
| `endpoint` | — | Full ingestion URL. |
| `apiKey` | — | Stamped as `x-ncpl-api-key`. |
| `debug` | `false` | Console output. |
| `disabled` | `false` | No-op mode for tests. |
| `batchSize` | `20` | Flush trigger. |
| `flushIntervalMs` | `5000` | Periodic flush. |
| `defaults` | `{}` | Metadata merged into every event. |
| `storage` | `localStorage` | Inject for SSR / tests. |
| `fetchImpl` | `globalThis.fetch` | Inject for Node < 18 or tests. |

## Helpers

| Method | Event name |
|---|---|
| `trackLogin(userId, meta?)` | `auth.login` (also `identify(userId)`) |
| `trackLogout(meta?)` | `auth.logout` (also `reset()`) |
| `trackPageView(path?, meta?)` | `navigation.page_view` |
| `trackNavigation(from, to, meta?)` | `navigation.route_change` |
| `trackFeatureUsage(feature, meta?)` | `feature.used` |
| `trackButtonClick(buttonId, meta?)` | `interaction.button_click` |
| `trackError(err, meta?)` | `error.captured` |
| `trackCustomEvent(name, meta?)` | *(your name)* |
| `track(event)` | generic escape hatch |
