import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module J — Customer Journey Flow repository.
 *
 * Builds an app-related PAGE flow: the sequence of pages each visitor moves
 * through within a session (e.g. Dashboard → Sprint Board → Ticket → QA),
 * derived from the `navigation.page_view` events the auto-capture script sends
 * (which carry metadata.path and metadata.title). Each (step, page) pair is a
 * distinct node so the Sankey reads left-to-right with no loops.
 */

export interface SankeyNode {
  name: string; // friendly page name
  step: number; // 1-based step index (for colouring)
}
export interface SankeyLink {
  source: number;
  target: number;
  value: number; // number of sessions taking this transition
}
export interface JourneyGraph {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalTransitions: number;
}

// Short tokens that should render upper-cased rather than title-cased.
const ACRONYMS = new Set(['qa', 'crm', 'api', 'hr', 'kpi', 'id', 'ui', 'ux', 'faq']);

function titleizeWord(w: string): string {
  if (!w) return w;
  if (ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function humanizeSegment(seg: string): string {
  const s = seg.replace(/[-_]+/g, ' ').trim();
  if (!s) return 'Home';
  return s.split(/\s+/).map(titleizeWord).join(' ');
}

/** Is a path segment an id (numeric / uuid / long hash) rather than a page name? */
function isIdLike(seg: string): boolean {
  return (
    /^\d+$/.test(seg) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) ||
    /^[0-9a-f]{16,}$/i.test(seg)
  );
}

/**
 * Friendly, app-related page name from a page_view event's metadata.
 *
 * Builds the name from the URL so it matches the app's own pages, and keeps
 * nested detail pages distinct:
 *   /                      → "Home"
 *   /sprint-board          → "Sprint Board"
 *   /tickets               → "Tickets"
 *   /tickets/123           → "Tickets › Detail"
 *   /projects/abc/settings → "Projects › Settings"
 * Falls back to the document title when no path is present.
 */
function pageLabel(meta: Record<string, unknown> | null | undefined): string {
  const path = typeof meta?.path === 'string' ? (meta.path as string) : '';
  const title = typeof meta?.title === 'string' ? (meta.title as string) : '';

  if (path) {
    const clean = path.split('?')[0]!.split('#')[0]!;
    const segs = clean.split('/').filter(Boolean);
    if (segs.length === 0) return 'Home';
    const parts = segs.map((s) => (isIdLike(s) ? 'Detail' : humanizeSegment(s)));
    // Keep the label short and readable: section + at most one nested part.
    return parts.slice(0, 2).join(' › ');
  }
  if (title) {
    const first = title.split(/[·|–—]/)[0]!.trim();
    return first || 'Page';
  }
  return 'Page';
}

export async function getJourneyGraph(
  days = 30,
  maxSteps = 5,
  topPerStep = 6,
): Promise<JourneyGraph> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('analytics_events')
    .select('session_id, occurred_at, metadata')
    .eq('name', 'navigation.page_view')
    .gte('occurred_at', since)
    .not('session_id', 'is', null)
    .order('occurred_at', { ascending: true })
    .limit(20000);

  if (error) throw new AppError('JOURNEY_FAILED', error.message, 500);

  // Ordered list of page labels per session, collapsing consecutive repeats
  // (refreshes / re-renders of the same page).
  const bySession = new Map<string, string[]>();
  for (const row of (data ?? []) as { session_id: string; metadata: Record<string, unknown> | null }[]) {
    const label = pageLabel(row.metadata);
    const arr = bySession.get(row.session_id) ?? [];
    if (arr[arr.length - 1] !== label) arr.push(label);
    bySession.set(row.session_id, arr);
  }

  // Aggregate consecutive-step transitions across all sessions.
  const trans = new Map<string, { fromStep: number; from: string; to: string; count: number }>();
  for (const seq of bySession.values()) {
    const steps = Math.min(seq.length - 1, maxSteps);
    for (let i = 0; i < steps; i++) {
      const from = seq[i]!;
      const to = seq[i + 1]!;
      const key = `${i}|${from}|${to}`;
      const cur = trans.get(key);
      if (cur) cur.count += 1;
      else trans.set(key, { fromStep: i, from, to, count: 1 });
    }
  }
  const rows = Array.from(trans.values());

  // Keep only the top transitions per step so the diagram stays legible.
  const byStep = new Map<number, typeof rows>();
  for (const r of rows) {
    let list = byStep.get(r.fromStep);
    if (!list) { list = []; byStep.set(r.fromStep, list); }
    list.push(r);
  }
  const kept: typeof rows = [];
  for (const [, list] of byStep) {
    list.sort((a, b) => b.count - a.count);
    kept.push(...list.slice(0, topPerStep));
  }

  // Build the node/link graph. Nodes keyed by `${step}:${label}` → forward-only.
  const nodeIndex = new Map<string, number>();
  const nodes: SankeyNode[] = [];
  const ensureNode = (step: number, label: string): number => {
    const key = `${step}:${label}`;
    let idx = nodeIndex.get(key);
    if (idx === undefined) {
      idx = nodes.length;
      nodeIndex.set(key, idx);
      nodes.push({ name: label, step });
    }
    return idx;
  };

  const links: SankeyLink[] = [];
  let totalTransitions = 0;
  for (const r of kept) {
    const source = ensureNode(r.fromStep, r.from);
    const target = ensureNode(r.fromStep + 1, r.to);
    links.push({ source, target, value: r.count });
    totalTransitions += r.count;
  }

  return { nodes, links, totalTransitions };
}
