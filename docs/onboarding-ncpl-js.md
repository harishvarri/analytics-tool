# Onboarding an application with `ncpl.js`

The fastest, zero-code way to add analytics to any web app. No SDK install, no
package management, no framework-specific integration.

## 1. Create the project
In the analytics dashboard: **Admin → Projects → Add New Project**. You get a
**project slug** (e.g. `crm`) and a **public key** (`ncpl_pk_…`).

## 2. Add one script tag
Place this once in the application's `<head>`:

```html
<script
  defer
  src="https://ncpl-analytics-tool.vercel.app/ncpl.js"
  data-project="crm"
  data-key="ncpl_pk_xxxxx"></script>
```

That's the entire integration. Within minutes the app appears in the dashboards.

## 3. How the tag gets added (no app-developer work)

| Method | Who does it | When |
|---|---|---|
| **GitHub PR (preferred)** | The platform team opens a 1-line PR; the app team just merges. | You have repo access |
| **Edge injection** | A Cloudflare Worker / Vercel rewrite injects the tag into the HTML response. | You control hosting/CDN |
| **Manual paste** | Anyone pastes the tag into `<head>`. | Quick start |

## What is captured automatically (no code)

- Page views + SPA route changes (history + hash)
- Sessions and engagement time
- Clicks on links/buttons (and any element with `data-ncpl-event="..."`)
- Form submits
- Device / browser / OS / screen / language / timezone
- Performance (TTFB, DOM interactive, load) via Navigation Timing
- JavaScript errors + unhandled promise rejections

These light up Overview, Audience, Journeys, Funnels (by URL), Retention,
Performance, Reliability, and Live Feed automatically.

## Optional custom events (no SDK needed)

The script exposes a tiny global. The app *may* call it, but isn't required to:

```js
window.ncpl.track('payment.completed', { amount: 4200 });
window.ncpl.identify('<user-uuid>');   // only if you have a real user UUID
window.ncpl.page();                     // force a page view
```

Event names are dot-namespaced; the part before the first dot becomes the
"feature" in Feature Adoption (e.g. `payment.completed` → feature `payment`).

## Script tag attributes

| Attribute | Required | Purpose |
|---|---|---|
| `data-project` | yes | project slug |
| `data-key` | yes | public ingest key |
| `data-endpoint` | no | override ingest URL (defaults to the script's origin) |
| `data-debug` | no | log captured events to the console |

## Security

The public key can **only create events** — no read, admin, project-management,
or data-modification access. Ingestion is rate-limited, origin-agnostic (CORS),
input-validated, and event-sanitized. Safe to expose in client-side HTML, exactly
like Google Analytics / PostHog keys.
