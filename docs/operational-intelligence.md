# NCPL Command Center — Operational Intelligence

An **internal operations & monitoring** platform for all NCPL apps. For a CEO/ops
view it answers, per app and across the org: who's active, who logged in, what's
breaking (errors / API failures), and whether each app is healthy.

**Per-app and event-driven** — every app is tracked independently from the events it
sends. There is **no central-SSO requirement**: each app identifies its own users on
login. (You can consolidate to one login later without changing this platform.)

## Onboard an app (2 steps)

1. **Register it** in the dashboard → Admin → Projects (gives a slug + `ncpl_pk_…` key).
2. **Add one script tag** to the app's `<head>`:

```html
<script defer
  src="https://ncpl-analytics-tool.vercel.app/ncpl.js"
  data-project="your-slug"
  data-key="ncpl_pk_..."></script>
```

That auto-captures page views, clicks, performance, and errors. The app then appears
in the Command Center, Applications, Journeys, Features, Audience, Reliability, etc.

## Identify users on login (so names show instead of "Anonymous")

```js
// LOGIN success
window.ncpl.identify(user.id);                  // if the app has a user id (uuid)
window.ncpl.identify(null, { email, name });    // or identify by email
window.ncpl.track('auth.login', { role });

// LOGOUT
window.ncpl.track('auth.logout');
```

Once identified, the person shows by name everywhere, and **People → click a user**
gives their full profile: logins, sessions, time on apps, and a recent activity
timeline.

## What you get
- **Command Center** — org pulse (active users, logins today, sessions, errors,
  health) + a per-app **health board** (status, active users, errors, error rate).
- **Applications / Cross-Project** — per-app usage and side-by-side comparison.
- **People** — who uses each app (filter to one app in the top bar) + per-user profile.
- **Behavior** — Journeys (page flow), Features (adoption), Retention (DAU/WAU/MAU).
- **Monitoring** — Reliability (errors, API failures, error rate, health),
  Performance (load times, slow pages), Anomalies (auto spike/drop alerts).
- **Audience** — device / browser / OS / language / region.

## Optional richer signals (apps emit these to populate more)
- Named feature events → **Features**: `window.ncpl.track('candidate.created')` etc.
- API failures → **Monitoring**: `window.ncpl.track('api.error', { route, status })`
  (or send `error`-category events from the backend).
