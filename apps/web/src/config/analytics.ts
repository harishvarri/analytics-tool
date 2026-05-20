/**
 * Canonical event name catalog. SDK helpers (trackLogin, trackPageView, …) emit
 * these. Custom events go through trackCustomEvent and bypass this list.
 */
export const EVENT_NAMES = {
  auth: {
    login: 'auth.login',
    logout: 'auth.logout',
    signup: 'auth.signup',
    sessionStart: 'auth.session_start',
    sessionEnd: 'auth.session_end',
  },
  navigation: {
    pageView: 'navigation.page_view',
    routeChange: 'navigation.route_change',
  },
  interaction: {
    buttonClick: 'interaction.button_click',
    formSubmit: 'interaction.form_submit',
  },
  feature: {
    used: 'feature.used',
  },
  error: {
    captured: 'error.captured',
  },
} as const;

export const EVENT_CATEGORIES = ['auth', 'navigation', 'feature', 'interaction', 'error', 'custom'] as const;
