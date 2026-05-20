/**
 * Training Portal — analytics wiring.
 *
 * Single module-scope client instance, configured from env. Re-exported
 * helpers so feature code reads `analytics.trackLessonViewed(42)` instead of
 * the raw SDK shape.
 */
import { AnalyticsClient } from '@ncpl/analytics-sdk';

const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT!;
const apiKey = process.env.NEXT_PUBLIC_ANALYTICS_KEY; // optional — usually set server-side

export const analytics = new AnalyticsClient({
  portalId: 'training',
  endpoint,
  ...(apiKey ? { apiKey } : {}),
  debug: process.env.NODE_ENV !== 'production',
  defaults: {
    release: process.env.NEXT_PUBLIC_RELEASE_SHA ?? 'dev',
    env: process.env.NODE_ENV,
  },
});

// ---------- Domain-specific track helpers ----------
// Centralizing these here means feature components never deal with raw event
// names or metadata shapes. Refactoring an event is a one-line change.

export const trackLessonViewed = (lessonId: number) =>
  analytics.trackFeatureUsage('lesson.viewed', { lessonId });

export const trackLessonCompleted = (lessonId: number, score: number) =>
  analytics.trackCustomEvent('lesson.completed', { lessonId, score });

export const trackQuizStarted = (quizId: string) =>
  analytics.trackFeatureUsage('quiz.started', { quizId });

export const trackCertificateEarned = (certId: string, path: string) =>
  analytics.trackCustomEvent('certificate.earned', { certId, path });
