/**
 * Canonical event name catalog. The helper trackers (trackLogin, …) emit
 * these names; consumers using `trackCustomEvent` choose their own.
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
  performance: {
    pageLoad: 'performance.page_load',
    engagement: 'performance.engagement',
  },
} as const;
