export const API_VERSION = 'v1';

export const API_PATHS = {
  events: `/api/${API_VERSION}/events`,
  health: `/api/${API_VERSION}/health`,
  analytics: {
    dashboard: `/api/${API_VERSION}/analytics/dashboard`,
    users: `/api/${API_VERSION}/analytics/users`,
    portals: `/api/${API_VERSION}/analytics/portals`,
    sessions: `/api/${API_VERSION}/analytics/sessions`,
  },
  realtime: `/api/${API_VERSION}/realtime`,
} as const;

export const MAX_EVENT_BATCH_SIZE = 50;
export const MAX_EVENT_PAYLOAD_BYTES = 32 * 1024; // 32KB
