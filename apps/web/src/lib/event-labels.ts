/**
 * Turns technical event names + raw metadata into plain, human-readable labels
 * and short descriptions for the activity feed UI.
 *
 * Strategy (in priority order):
 *   1. Use metadata fields (pageName, featureName, label, route…) for specificity.
 *   2. Fall back to page name extracted from the event URL.
 *   3. Fall back to a static lookup table of known event names.
 *   4. Humanise the dot-separated name as a last resort.
 *
 * Works generically for ANY web application — no app-specific assumptions.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function sentenceCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Pick the first non-empty string value from metadata under any of the given keys. */
function pick(
  meta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Convert a URL or pathname into a human-readable page name.
 *
 * Examples:
 *   /                          → "Home"
 *   /dashboard                 → "Dashboard"
 *   /dashboard/settings        → "Settings"
 *   /projects/123/board        → "Board"
 *   /tickets/PROJ-456          → "Tickets"
 *   /admin/users               → "Users"
 *   /reports/weekly            → "Weekly Reports"
 */
export function pageNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // Accept both full URLs and relative paths
    const raw = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]!.split('#')[0]!;
    const segments = raw.split('/').filter(Boolean);

    if (segments.length === 0) return 'Home';

    /** True for path segments that are IDs, not page names. */
    const isId = (s: string) =>
      /^\d+$/.test(s) ||                           // numeric id
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) ||      // UUID
      /^[a-z]{2,6}-\d+$/i.test(s) ||               // PROJ-123 style
      /^[a-f0-9]{24,}$/i.test(s);                  // mongo ObjectId / hash

    const meaningful = segments.filter((s) => !isId(s));
    if (meaningful.length === 0) return 'Page';

    const last  = meaningful[meaningful.length - 1]!;
    const prev  = meaningful.length > 1 ? meaningful[meaningful.length - 2] : null;

    // Ignored "container" segments that add no page context
    const SKIP = new Set(['dashboard', 'app', 'portal', 'admin', 'api', 'v1', 'v2', 'web']);

    const lastLabel = titleCase(last.replace(/[-_]/g, ' '));
    const prevLabel = prev && !SKIP.has(prev) ? titleCase(prev.replace(/[-_]/g, ' ')) : null;

    return prevLabel ? `${prevLabel} · ${lastLabel}` : lastLabel;
  } catch {
    return null;
  }
}

// ── Static label / description tables ────────────────────────────────────────

const FRIENDLY: Record<string, string> = {
  // navigation
  'navigation.page_view':    'Viewed a page',
  'navigation.route_change': 'Moved to a new page',
  'navigation.time_on_page': 'Spent time on a page',
  // interaction
  'interaction.click':        'Clicked something',
  'interaction.button_click': 'Clicked a button',
  'interaction.form_submit':  'Submitted a form',
  // auth
  'auth.login':         'Signed in',
  'auth.logout':        'Signed out',
  'auth.login_failed':  'Sign-in failed',
  'auth.signup':        'Signed up',
  'auth.session_start': 'Session started',
  'session.start':      'Session started',
  // performance / error
  'performance.page_load':  'Page loaded',
  'performance.engagement': 'Spent time on a page',
  'feature.used':           'Used a feature',
  'error.captured':         'Encountered an error',
  // common product vocabulary
  'ticket.viewed':          'Opened a ticket',
  'ticket.status_changed':  'Changed a ticket status',
  'ticket.comment_added':   'Commented on a ticket',
  'ticket.assigned':        'Assigned a ticket',
  'ticket.created':         'Created a ticket',
  'board.viewed':           'Opened the board',
  'board.ticket_moved':     'Moved a card on the board',
  'qa.ticket_reviewed':     'Reviewed a ticket in QA',
  'project.viewed':         'Opened a project',
  'project.created':        'Created a project',
  'comment.added':          'Added a comment',
  'settings.profile_updated': 'Updated their profile',
  'settings.updated':       'Changed settings',
  'search.performed':       'Searched',
  'file.uploaded':          'Uploaded a file',
  'file.downloaded':        'Downloaded a file',
  'report.viewed':          'Viewed a report',
  'report.exported':        'Exported a report',
  'notification.opened':    'Opened a notification',
  'user.invited':           'Invited a team member',
};

const DESCRIPTIONS: Record<string, string> = {
  'navigation.page_view':    'Someone opened a page in the app.',
  'navigation.route_change': 'They navigated from one page to another.',
  'navigation.time_on_page': 'How long the user actively spent on a page.',
  'interaction.click':       'They clicked a button, link, or control.',
  'interaction.button_click':'They pressed a button.',
  'interaction.form_submit': 'They submitted a form (e.g. login, create, save).',
  'auth.login':              'A user signed in to the app.',
  'auth.logout':             'A user signed out.',
  'auth.login_failed':       'A sign-in attempt failed.',
  'auth.signup':             'A new account was created.',
  'auth.session_start':      'A new visit/session began.',
  'session.start':           'A new visit/session began.',
  'performance.page_load':   'Measured how fast a page loaded for the user.',
  'performance.engagement':  'How long the user actively spent on a page.',
  'feature.used':            'The user engaged with a product feature.',
  'error.captured':          'Something went wrong in the app for this user.',
  'ticket.viewed':           "The user opened a ticket's detail page.",
  'ticket.status_changed':   'The user moved a ticket to a different status.',
  'ticket.comment_added':    'The user wrote a comment on a ticket.',
  'ticket.assigned':         'The user assigned a ticket to someone.',
  'ticket.created':          'The user created a new ticket.',
  'board.viewed':            'The user opened the sprint/kanban board.',
  'board.ticket_moved':      'The user dragged a card to a new column on the board.',
  'qa.ticket_reviewed':      'The user verified or rejected a ticket in QA.',
  'project.viewed':          'The user opened a project page.',
  'project.created':         'The user created a new project.',
  'comment.added':           'The user posted a comment.',
  'settings.profile_updated':'The user changed their profile details.',
  'settings.updated':        'The user changed a setting.',
  'search.performed':        'The user ran a search.',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Human-readable label for an event.
 *
 * Uses metadata and URL to produce specific labels like:
 *   "Viewed Settings"         (navigation + route)
 *   "Used Export to CSV"      (feature.used + featureName)
 *   'Clicked "Save Report"'   (interaction + label)
 *   "Searched for issues"     (search + query)
 *
 * @param name     Raw event name (e.g. "navigation.page_view")
 * @param meta     Event metadata object from the DB
 * @param url      Page URL at the time of the event
 */
export function friendlyEventName(
  name: string,
  meta?: Record<string, unknown> | null,
  url?: string | null,
): string {
  if (!name) return 'Activity';
  const lname = name.toLowerCase();

  // ── Navigation — show the actual page name ───────────────────────────────
  if (lname.startsWith('navigation.')) {
    const pageName =
      pick(meta, 'pageName', 'pageTitle', 'title', 'page') ??
      pageNameFromUrl(pick(meta, 'route', 'path', 'to', 'href', 'pathname') ?? url);

    if (pageName) {
      if (lname === 'navigation.time_on_page') return `Time on ${pageName}`;
      if (lname === 'navigation.route_change') return `Went to ${pageName}`;
      return `Viewed ${pageName}`;
    }
  }

  // ── Performance engagement — show page name ──────────────────────────────
  if (lname === 'performance.engagement' || lname === 'performance.page_load') {
    const pageName =
      pick(meta, 'pageName', 'page', 'route', 'path') ??
      pageNameFromUrl(pick(meta, 'route', 'path') ?? url);
    if (pageName) return `${lname === 'performance.page_load' ? 'Loaded' : 'Active on'} ${pageName}`;
  }

  // ── Feature usage — show feature name ────────────────────────────────────
  if (lname === 'feature.used' || lname.startsWith('feature.')) {
    const featureName = pick(meta, 'featureName', 'feature', 'label', 'name', 'featureId', 'featureKey');
    if (featureName) {
      const readable = titleCase(featureName.replace(/[._\-\/]+/g, ' '));
      return `Used ${readable}`;
    }
  }

  // ── Interactions — show what was clicked / submitted ─────────────────────
  if (lname.startsWith('interaction.')) {
    const label = pick(meta, 'label', 'text', 'buttonText', 'buttonLabel', 'ariaLabel', 'name', 'placeholder', 'value');
    if (label) {
      const short = label.length > 32 ? label.slice(0, 32) + '…' : label;
      if (lname === 'interaction.form_submit') return `Submitted "${short}"`;
      return `Clicked "${short}"`;
    }
    // Form submit without label — try form name
    if (lname === 'interaction.form_submit') {
      const form = pick(meta, 'formName', 'form', 'formId', 'action');
      if (form) return `Submitted ${titleCase(form.replace(/[._-]/g, ' '))}`;
    }
  }

  // ── Search — show what they searched for ─────────────────────────────────
  if (lname === 'search.performed' || lname.includes('search')) {
    const query = pick(meta, 'query', 'q', 'keyword', 'term', 'searchQuery');
    if (query) {
      const short = query.length > 24 ? query.slice(0, 24) + '…' : query;
      return `Searched "${short}"`;
    }
  }

  // ── Auth events — show method/provider if known ───────────────────────────
  if (lname === 'auth.login') {
    const method = pick(meta, 'method', 'provider', 'strategy');
    if (method) return `Signed in via ${sentenceCase(method)}`;
  }

  // ── Error events — show error type or short message ──────────────────────
  if (lname === 'error.captured' || lname.startsWith('error.')) {
    const type = pick(meta, 'errorType', 'type', 'code', 'errorCode');
    if (type) return `Error: ${type}`;
    const msg = pick(meta, 'message', 'errorMessage', 'description');
    if (msg) {
      const short = msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
      return `Error: ${short}`;
    }
  }

  // ── File operations ───────────────────────────────────────────────────────
  if (lname.includes('file') || lname.includes('upload') || lname.includes('download')) {
    const filename = pick(meta, 'fileName', 'filename', 'name', 'file');
    if (filename) {
      const short = filename.length > 28 ? '…' + filename.slice(-25) : filename;
      if (lname.includes('upload')) return `Uploaded "${short}"`;
      if (lname.includes('download')) return `Downloaded "${short}"`;
    }
  }

  // ── Known static label ────────────────────────────────────────────────────
  const known = FRIENDLY[lname];
  if (known) return known;

  // ── Generic fallback: humanise the dot-separated name ────────────────────
  const parts = name.split('.');
  const readable = parts
    .map((p) => p.replace(/[_-]+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  return sentenceCase(readable) || 'Activity';
}

/**
 * Short plain-English description of what an event means.
 * Uses metadata and URL for more specific context where available.
 */
export function eventDescription(
  name: string,
  meta?: Record<string, unknown> | null,
  url?: string | null,
): string {
  if (!name) return '';
  const lname = name.toLowerCase();

  // Navigation
  if (lname.startsWith('navigation.') || lname === 'performance.page_load' || lname === 'performance.engagement') {
    const route =
      pick(meta, 'route', 'path', 'to', 'href', 'pathname') ??
      (url?.startsWith('http') ? (() => { try { return new URL(url).pathname; } catch { return url; } })() : url);
    const pageName =
      pick(meta, 'pageName', 'pageTitle', 'title', 'page') ??
      pageNameFromUrl(route);

    if (lname === 'navigation.time_on_page' || lname === 'performance.engagement') {
      const ms = meta?.duration_ms ?? meta?.durationMs ?? meta?.timeMs;
      if (typeof ms === 'number' && ms > 0) {
        const secs = Math.round(ms / 1000);
        return `Actively used ${pageName ?? 'the page'} for ${secs}s.`;
      }
      return `How long the user actively spent on ${pageName ?? 'the page'}.`;
    }
    if (route) return `Navigated to ${route}.`;
    return `They opened ${pageName ? `the ${pageName} page` : 'a page'} in the app.`;
  }

  // Feature
  if (lname === 'feature.used') {
    const feature = pick(meta, 'featureName', 'feature', 'label', 'name');
    const context = pick(meta, 'context', 'section', 'page', 'area');
    if (feature && context) return `The "${feature}" feature was used in the ${context} section.`;
    if (feature) return `The user activated the "${feature}" feature.`;
  }

  // Interaction
  if (lname.startsWith('interaction.')) {
    const label = pick(meta, 'label', 'text', 'buttonText', 'buttonLabel');
    const pageName = pageNameFromUrl(pick(meta, 'route', 'path') ?? url);
    if (label && pageName) return `Clicked "${label}" on the ${pageName} page.`;
    if (label) return `Clicked the "${label}" control.`;
    return DESCRIPTIONS[lname] ?? 'They clicked a button, link, or control.';
  }

  // Error
  if (lname === 'error.captured') {
    const msg = pick(meta, 'message', 'errorMessage', 'description');
    if (msg) return msg.length > 100 ? msg.slice(0, 100) + '…' : msg;
  }

  // Search
  if (lname === 'search.performed') {
    const query = pick(meta, 'query', 'q', 'keyword', 'term');
    if (query) return `Searched for "${query}".`;
  }

  // Static fallback
  const known = DESCRIPTIONS[lname];
  if (known) return known;

  // Generic
  const [feature, ...rest] = name.split('.');
  const action = rest.join(' ').replace(/[._]+/g, ' ').trim();
  if (feature && action) return `A "${action}" action in the ${feature} area of the app.`;
  return 'A tracked action in the app.';
}

/** Plain-English label for an event category. */
export function friendlyCategory(category: string): string {
  const map: Record<string, string> = {
    auth:        'Sign-ins',
    navigation:  'Navigation',
    feature:     'Feature use',
    interaction: 'Interactions',
    error:       'Problems',
    custom:      'Custom activity',
    performance: 'Performance',
    analytics:   'Analytics',
  };
  return map[category] ?? sentenceCase(category);
}
