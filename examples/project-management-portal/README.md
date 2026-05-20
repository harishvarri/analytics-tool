# Project Management Portal — Analytics Integration

Reference integration for a **Vite + React Router** SPA.

## Files

| Path | What it does |
|---|---|
| [`src/analytics/client.ts`](src/analytics/client.ts) | Singleton `AnalyticsClient` + domain helpers |
| [`src/analytics/AnalyticsRoot.tsx`](src/analytics/AnalyticsRoot.tsx) | Provider + `useLocation` pageview + identity sync |
| [`src/components/Board.tsx`](src/components/Board.tsx) | Feature component using a domain helper |

## Wiring

```tsx
// main.tsx
import { BrowserRouter } from 'react-router-dom';
import { AnalyticsRoot } from '@/analytics/AnalyticsRoot';

root.render(
  <BrowserRouter>
    <AnalyticsRoot>
      <App />
    </AnalyticsRoot>
  </BrowserRouter>,
);
```

## Patterns

- **Build-time config** via `import.meta.env` (Vite). The SDK reads the endpoint once at module load.
- **`useLocation()` pageview** instead of `usePathname()`. Same shape, different router.
- **Identity sync from your auth hook** — pluggable, no opinion on what auth library you use.
- **No ingest key in the browser.** This portal trusts CORS + the platform's authn at the gateway. Set the key server-side if you proxy events.
