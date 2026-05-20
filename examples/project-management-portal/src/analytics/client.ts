/**
 * Project Management Portal — analytics client.
 *
 * SPA case: no SSR, env baked in at build time.
 */
import { AnalyticsClient } from '@ncpl/analytics-sdk';

export const analytics = new AnalyticsClient({
  portalId: 'project-management',
  endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
  debug: import.meta.env.DEV,
  defaults: { release: import.meta.env.VITE_RELEASE_SHA ?? 'dev' },
});

export const trackProjectCreated = (projectId: string, template: string | null) =>
  analytics.trackFeatureUsage('project.created', { projectId, template });

export const trackTaskMoved = (taskId: string, fromColumn: string, toColumn: string) =>
  analytics.trackFeatureUsage('task.moved', { taskId, fromColumn, toColumn });

export const trackBoardSearched = (query: string) =>
  analytics.trackCustomEvent('board.searched', { queryLength: query.length });
