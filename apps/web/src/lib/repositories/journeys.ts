import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module J — Customer Journey Flow repository.
 *
 * Calls journey_steps(p_days, p_max_steps) (migration 0014) and assembles a
 * Sankey node/link graph. Each (step, event) pair is a distinct node so the
 * flow is acyclic and reads left-to-right like Amplitude/Mixpanel path flows.
 */

export interface SankeyNode {
  name: string;   // display label (event name)
  step: number;   // 1-based step index (for coloring / debugging)
}

export interface SankeyLink {
  source: number; // node index
  target: number; // node index
  value:  number; // transitions
}

export interface JourneyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** total transitions represented */
  totalTransitions: number;
}

interface StepRow {
  from_step:   number;
  from_event:  string;
  to_event:    string;
  transitions: number;
  sessions:    number;
}

export async function getJourneyGraph(
  days = 30,
  maxSteps = 5,
  topPerStep = 6,
): Promise<JourneyGraph> {
  const { data, error } = await getSupabaseAdmin().rpc('journey_steps', {
    p_days: days,
    p_max_steps: maxSteps,
  });

  if (error) throw new AppError('JOURNEY_FAILED', error.message, 500);

  const rows = ((data ?? []) as StepRow[]).map((r) => ({
    fromStep:    Number(r.from_step),
    fromEvent:   r.from_event,
    toEvent:     r.to_event,
    transitions: Number(r.transitions),
  }));

  // Keep only the top-N transitions per from_step to keep the diagram legible.
  const byStep = new Map<number, typeof rows>();
  for (const r of rows) {
    let list = byStep.get(r.fromStep);
    if (!list) { list = []; byStep.set(r.fromStep, list); }
    list.push(r);
  }
  const kept: typeof rows = [];
  for (const [, list] of byStep) {
    list.sort((a, b) => b.transitions - a.transitions);
    kept.push(...list.slice(0, topPerStep));
  }

  // Build node index map keyed by `${step}:${event}`.
  const nodeIndex = new Map<string, number>();
  const nodes: SankeyNode[] = [];
  const ensureNode = (step: number, event: string): number => {
    const key = `${step}:${event}`;
    let idx = nodeIndex.get(key);
    if (idx === undefined) {
      idx = nodes.length;
      nodeIndex.set(key, idx);
      nodes.push({ name: event, step });
    }
    return idx;
  };

  const links: SankeyLink[] = [];
  let totalTransitions = 0;
  for (const r of kept) {
    const source = ensureNode(r.fromStep, r.fromEvent);
    const target = ensureNode(r.fromStep + 1, r.toEvent);
    links.push({ source, target, value: r.transitions });
    totalTransitions += r.transitions;
  }

  return { nodes, links, totalTransitions };
}
