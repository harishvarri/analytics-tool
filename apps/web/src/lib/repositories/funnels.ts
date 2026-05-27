import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';
import type { FunnelDef } from '@/config/funnels';

/**
 * Module I — Funnel Analytics repository.
 *
 * Computes an ordered, first-touch funnel from v_event_first_times
 * (migration 0013). For each user we have the earliest time they fired each
 * event; a user "reaches" step N if first(stepN) >= first(stepN-1).
 *
 * The computation is done in JS over a small result set (one row per
 * user × relevant-event) so funnels can be defined dynamically in code without
 * fragile dynamic SQL.
 */

export interface FunnelStepResult {
  index:         number;
  event:         string;
  label:         string;
  users:         number;   // users who reached this step
  conversionPct: number;   // % of step 1 users who reached this step
  stepPct:       number;   // % of previous step's users who continued
  dropOff:       number;   // users lost vs previous step
}

export interface FunnelResult {
  id:              string;
  name:            string;
  description:     string;
  steps:           FunnelStepResult[];
  /** users entering at step 1 */
  entered:         number;
  /** users completing the final step */
  completed:       number;
  /** overall conversion (completed / entered) */
  overallPct:      number;
  /** the single biggest drop-off step (by users lost), if any */
  biggestDropIndex: number | null;
}

interface FirstTimeRow {
  user_id: string;
  name:    string;
  first_at: string;
}

export async function getFunnel(def: FunnelDef, days = 30): Promise<FunnelResult> {
  const eventNames = def.steps.map((s) => s.event);

  const { data, error } = await getSupabaseAdmin()
    .from('v_event_first_times')
    .select('user_id, name, first_at')
    .in('name', eventNames);

  if (error) throw new AppError('FUNNEL_FAILED', error.message, 500);

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // Build: userId → { eventName → firstAt(ms) }, restricted to the date window.
  const byUser = new Map<string, Map<string, number>>();
  for (const r of (data ?? []) as FirstTimeRow[]) {
    const t = new Date(r.first_at).getTime();
    if (t < cutoff) continue;
    let m = byUser.get(r.user_id);
    if (!m) { m = new Map(); byUser.set(r.user_id, m); }
    // keep the earliest if duplicated
    const existing = m.get(r.name);
    if (existing === undefined || t < existing) m.set(r.name, t);
  }

  // Count users reaching each step with strict monotonic first-touch ordering.
  const stepUsers = new Array(def.steps.length).fill(0) as number[];
  for (const events of byUser.values()) {
    let prevTime = -Infinity;
    for (let i = 0; i < def.steps.length; i++) {
      const t = events.get(def.steps[i]!.event);
      if (t === undefined || t < prevTime) break;  // didn't reach this step in order
      stepUsers[i]! += 1;
      prevTime = t;
    }
  }

  const entered = stepUsers[0] ?? 0;
  const steps: FunnelStepResult[] = def.steps.map((s, i) => {
    const users = stepUsers[i] ?? 0;
    const prevUsers = i === 0 ? users : (stepUsers[i - 1] ?? 0);
    return {
      index:         i,
      event:         s.event,
      label:         s.label,
      users,
      conversionPct: entered > 0 ? Math.round((users / entered) * 1000) / 10 : 0,
      stepPct:       prevUsers > 0 ? Math.round((users / prevUsers) * 1000) / 10 : 0,
      dropOff:       i === 0 ? 0 : Math.max(0, prevUsers - users),
    };
  });

  // Biggest drop-off step (largest users lost between consecutive steps)
  let biggestDropIndex: number | null = null;
  let biggestDrop = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i]!.dropOff > biggestDrop) {
      biggestDrop = steps[i]!.dropOff;
      biggestDropIndex = i;
    }
  }

  const completed = stepUsers[stepUsers.length - 1] ?? 0;

  return {
    id:          def.id,
    name:        def.name,
    description: def.description,
    steps,
    entered,
    completed,
    overallPct:  entered > 0 ? Math.round((completed / entered) * 1000) / 10 : 0,
    biggestDropIndex,
  };
}
