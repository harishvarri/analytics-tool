/**
 * Turns technical event names into plain, human-readable labels AND short
 * descriptions for the UI.
 *
 *   navigation.page_view   → "Page viewed"     + "Someone opened a page in the app."
 *   board.ticket_moved     → "Board ticket moved" (humanised) + generated description
 *
 * The label/description maps cover the common auto-capture events and a generic
 * product vocabulary (ticket, board, qa, project, comment, settings). Anything
 * unknown is humanised and given a generated description, so the tool stays
 * generic and still reads well for ANY app.
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
  // performance / error
  'performance.page_load': 'Page loaded',
  'performance.engagement': 'Spent time on a page',
  'feature.used': 'Used a feature',
  'error.captured': 'Hit an error',
  // common product vocabulary (works for most apps)
  'ticket.viewed': 'Opened a ticket',
  'ticket.status_changed': 'Changed a ticket’s status',
  'ticket.comment_added': 'Commented on a ticket',
  'ticket.assigned': 'Assigned a ticket',
  'ticket.created': 'Created a ticket',
  'board.viewed': 'Opened a board',
  'board.ticket_moved': 'Moved a card on the board',
  'qa.ticket_reviewed': 'Reviewed a ticket in QA',
  'project.viewed': 'Opened a project',
  'project.created': 'Created a project',
  'comment.added': 'Added a comment',
  'settings.profile_updated': 'Updated their profile',
  'settings.updated': 'Changed settings',
  'search.performed': 'Searched',
};

const DESCRIPTIONS: Record<string, string> = {
  'navigation.page_view': 'Someone opened a page in the app.',
  'navigation.route_change': 'They navigated from one page to another.',
  'navigation.time_on_page': 'How long they stayed on a page before leaving.',
  'interaction.click': 'They clicked a button, link, or control.',
  'interaction.button_click': 'They pressed a button.',
  'interaction.form_submit': 'They submitted a form (e.g. login, create, save).',
  'auth.login': 'A user signed in to the app.',
  'auth.logout': 'A user signed out.',
  'auth.login_failed': 'A sign-in attempt failed (wrong details or error).',
  'auth.signup': 'A new account was created.',
  'auth.session_start': 'A new visit/session began.',
  'session.start': 'A new visit/session began.',
  'performance.page_load': 'Measured how fast a page loaded for the user.',
  'performance.engagement': 'How long the user actively spent on a page.',
  'feature.used': 'The user engaged with a product feature.',
  'error.captured': 'Something went wrong in the app for this user.',
  'ticket.viewed': 'The user opened a ticket’s detail page.',
  'ticket.status_changed': 'The user moved a ticket to a different status.',
  'ticket.comment_added': 'The user wrote a comment on a ticket.',
  'ticket.assigned': 'The user assigned a ticket to someone.',
  'ticket.created': 'The user created a new ticket.',
  'board.viewed': 'The user opened the sprint/kanban board.',
  'board.ticket_moved': 'The user dragged a card to a new column on the board.',
  'qa.ticket_reviewed': 'The user verified or rejected a ticket in QA.',
  'project.viewed': 'The user opened a project’s page.',
  'project.created': 'The user created a new project.',
  'comment.added': 'The user posted a comment.',
  'settings.profile_updated': 'The user changed their profile details.',
  'settings.updated': 'The user changed a setting.',
  'search.performed': 'The user ran a search.',
};

function sentenceCase(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Friendly label for an event name (humanised fallback for unknowns). */
export function friendlyEventName(name: string): string {
  if (!name) return 'Activity';
  const known = FRIENDLY[name.toLowerCase()];
  if (known) return known;
  return sentenceCase(name.replace(/[._]+/g, ' ').trim());
}

/**
 * Short plain-English note describing what an event means in the app flow.
 * Falls back to a generated sentence from the event's namespace + action.
 */
export function eventDescription(name: string): string {
  if (!name) return '';
  const known = DESCRIPTIONS[name.toLowerCase()];
  if (known) return known;

  // Generic: "<feature>.<action>" → "An '<action>' action in the <feature> area."
  const [feature, ...rest] = name.split('.');
  const action = rest.join(' ').replace(/[._]+/g, ' ').trim();
  if (feature && action) {
    return `A “${action}” action in the ${feature} area of the app.`;
  }
  return 'A tracked action in the app.';
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
