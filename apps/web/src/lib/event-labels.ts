/**
 * Turns technical event names into plain, human-readable labels for the UI.
 *
 *   navigation.page_view      → "Page viewed"
 *   interaction.click         → "Clicked something"
 *   ticket.status_changed     → "Ticket status changed"  (humanised fallback)
 *
 * Keep the raw name available as a tooltip where space allows.
 */

const FRIENDLY: Record<string, string> = {
  // navigation
  'navigation.page_view': 'Page viewed',
  'navigation.route_change': 'Moved to a new page',
  'navigation.time_on_page': 'Time on page',
  // interaction
  'interaction.click': 'Clicked something',
  'interaction.button_click': 'Clicked a button',
  'interaction.form_submit': 'Submitted a form',
  // auth
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.login_failed': 'Sign-in failed',
  'auth.signup': 'Signed up',
  'auth.session_start': 'Session started',
  'session.start': 'Session started',
  // performance
  'performance.page_load': 'Page loaded',
  'performance.engagement': 'Spent time on a page',
  // feature / error
  'feature.used': 'Used a feature',
  'error.captured': 'Hit an error',
};

/** Capitalise the first letter only. */
function sentenceCase(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Friendly label for an event name. Falls back to a humanised version of the
 * raw name (dots/underscores → spaces) so even unknown/custom events read well.
 */
export function friendlyEventName(name: string): string {
  if (!name) return 'Activity';
  const known = FRIENDLY[name.toLowerCase()];
  if (known) return known;
  return sentenceCase(name.replace(/[._]+/g, ' ').trim());
}

/** Plain-English label for an event category. */
export function friendlyCategory(category: string): string {
  const map: Record<string, string> = {
    auth: 'Account',
    navigation: 'Navigation',
    feature: 'Feature use',
    interaction: 'Interaction',
    error: 'Error',
    custom: 'Activity',
  };
  return map[category] ?? sentenceCase(category);
}
