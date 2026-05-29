/**
 * Funnel definitions for Module I — Funnel Analytics.
 *
 * Each funnel is an ordered list of steps. A step references the canonical
 * event name emitted by a portal (see the analytics SDK / Sentinel tracker).
 * Funnels are defined in code (not the DB) so they are versioned, type-checked,
 * and trivially extensible per application.
 *
 * To add a funnel for a new product, append an entry here — no schema change.
 */

export interface FunnelStep {
  /** Canonical event name, e.g. "auth.login" */
  event: string;
  /** Human label shown in the funnel chart */
  label: string;
}

export interface FunnelDef {
  id:          string;
  name:        string;
  description: string;
  /** Application this funnel belongs to (matches portal_id), or 'all' */
  app:         string;
  steps:       FunnelStep[];
}

/**
 * Generic, app-agnostic funnels that work out-of-the-box with the auto-capture
 * script (ncpl.js) — no per-app event wiring needed. Each step references an
 * event that ncpl.js emits automatically for ANY website.
 *
 * To measure a product-specific flow (e.g. checkout), add a funnel here whose
 * steps reference your own `window.ncpl.track(...)` event names.
 */
export const FUNNELS: readonly FunnelDef[] = [
  {
    id: 'engagement',
    name: 'Visitor Engagement',
    description: 'How far visitors get: from landing, to interacting, to completing a form.',
    app: 'all',
    steps: [
      { event: 'navigation.page_view',   label: 'Visited the app' },
      { event: 'interaction.click',      label: 'Clicked something' },
      { event: 'interaction.form_submit', label: 'Submitted a form' },
    ],
  },
  {
    id: 'exploration',
    name: 'Exploration',
    description: 'Do visitors go beyond the first page and take an action?',
    app: 'all',
    steps: [
      { event: 'navigation.page_view',    label: 'Landed on a page' },
      { event: 'navigation.route_change', label: 'Explored another page' },
      { event: 'interaction.click',       label: 'Took an action' },
    ],
  },
] as const;

export const DEFAULT_FUNNEL_ID = FUNNELS[0]!.id;

export function getFunnelById(id?: string | null): FunnelDef {
  return FUNNELS.find((f) => f.id === id) ?? FUNNELS[0]!;
}
