# Resume Marketing Portal — Analytics Integration

Reference integration for a **legacy / vanilla-JS portal** where bundling the SDK isn't practical.

## Files

| Path | What it does |
|---|---|
| [`public/analytics.js`](public/analytics.js) | Self-contained tracker: session, batched queue, sendBeacon on unload |
| [`public/index.html`](public/index.html) | Drop-in `<script>` + example track calls |

## Wiring

```html
<script>
  window.NCPL_CONFIG = { endpoint: 'https://analytics.ncpl.internal/api/v1/events' };
</script>
<script src="/analytics.js" defer></script>
```

Then call `NCPL.track('feature', 'resume.submitted', { source: 'cta' })` from anywhere.

## Patterns

- **No bundler required** — paste-and-go, works in any HTML page or server-rendered template.
- **Same wire format** as the typed SDK so the backend treats events identically.
- **Best-effort delivery** — `sendBeacon` on unload, fetch + keepalive otherwise.
- **localStorage session/user** — persists across reloads in the same tab.

## When to use this instead of the typed SDK

- The portal can't bundle ESM (legacy build pipeline).
- You only need page views + a handful of named events.
- Bundle size is sensitive (this is ~1.5 KB minified).

For any other case, prefer `@ncpl/analytics-sdk` — you get strict TS, retry/backoff, batch tuning, and React hooks for free.
