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

export const FUNNELS: readonly FunnelDef[] = [
  {
    id:   'activation',
    name: 'User Activation',
    description: 'From sign-in to first meaningful action on a ticket.',
    app:  'sentinel',
    steps: [
      { event: 'auth.login',           label: 'Signed in' },
      { event: 'dashboard.viewed',     label: 'Viewed dashboard' },
      { event: 'board.viewed',         label: 'Opened a board' },
      { event: 'ticket.viewed',        label: 'Opened a ticket' },
      { event: 'ticket.status_changed', label: 'Moved a ticket' },
    ],
  },
  {
    id:   'ticket-workflow',
    name: 'Ticket Workflow',
    description: 'How users progress a ticket from view to comment to status change.',
    app:  'sentinel',
    steps: [
      { event: 'ticket.viewed',         label: 'Viewed ticket' },
      { event: 'ticket.comment_added',  label: 'Added a comment' },
      { event: 'ticket.assigned',       label: 'Assigned it' },
      { event: 'ticket.status_changed', label: 'Changed status' },
    ],
  },
  {
    id:   'qa-cycle',
    name: 'QA Verification',
    description: 'From opening a ticket to completing QA review.',
    app:  'sentinel',
    steps: [
      { event: 'board.viewed',      label: 'Opened board' },
      { event: 'ticket.viewed',     label: 'Opened ticket' },
      { event: 'qa.ticket_reviewed', label: 'Reviewed in QA' },
    ],
  },
] as const;

export const DEFAULT_FUNNEL_ID = FUNNELS[0]!.id;

export function getFunnelById(id?: string | null): FunnelDef {
  return FUNNELS.find((f) => f.id === id) ?? FUNNELS[0]!;
}
