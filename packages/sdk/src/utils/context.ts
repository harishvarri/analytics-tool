/**
 * Zero-dependency browser context + performance helpers used by auto-tracking.
 * All functions are SSR-safe (return {} / null when window is unavailable).
 */

export function getDeviceContext(): Record<string, unknown> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};

  const ua = navigator.userAgent;
  const w = window.screen?.width ?? 0;
  const h = window.screen?.height ?? 0;

  let browser = 'other';
  if (/Edg\//.test(ua)) browser = 'edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'opera';
  else if (/Chrome\//.test(ua)) browser = 'chrome';
  else if (/Firefox\//.test(ua)) browser = 'firefox';
  else if (/Safari\//.test(ua)) browser = 'safari';

  let os = 'other';
  if (/Windows/.test(ua)) os = 'windows';
  else if (/Mac OS X/.test(ua)) os = 'macos';
  else if (/Android/.test(ua)) os = 'android';
  else if (/Linux/.test(ua)) os = 'linux';
  else if (/iPhone|iPad/.test(ua)) os = 'ios';

  const deviceType = w > 0 && w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';

  return {
    browser,
    os,
    deviceType,
    screenResolution: `${w}x${h}`,
    language: navigator.language,
    timezone: safeTimezone(),
    connectionType:
      (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
  };
}

function safeTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export interface NavigationTimingMetrics {
  ttfbMs: number;
  domInteractiveMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  transferKb: number | null;
}

/**
 * Reads Navigation Timing Level 2 metrics. Returns null if unavailable or if
 * the page hasn't finished loading yet.
 */
export function getNavigationTiming(): NavigationTimingMetrics | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return null;
  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const nav = entries[0];
  if (!nav || nav.loadEventEnd <= 0) return null;

  const round = (n: number) => Math.max(0, Math.round(n));
  return {
    ttfbMs: round(nav.responseStart),
    domInteractiveMs: round(nav.domInteractive),
    domContentLoadedMs: round(nav.domContentLoadedEventEnd),
    loadMs: round(nav.loadEventEnd),
    transferKb: nav.transferSize ? Math.round(nav.transferSize / 1024) : null,
  };
}
