/**
 * User Productivity Score — a single 0–100 number per person, from the activity
 * signals we already capture. Roadmap formula:
 *   (Time spent + Actions + Feature/product usage + Sessions) − Errors
 * normalized to 0–100 and weighted toward meaningful actions.
 */

export interface ProductivityInputs {
  activeMinutes: number;   // total session minutes
  businessActions: number; // operational/business events (not page views)
  sessions: number;        // work sessions
  productsUsed: number;    // distinct apps used (feature/product breadth)
  errors: number;          // errors the user triggered
}

export interface ProductivityResult {
  score: number;           // 0–100
  band: 'high' | 'medium' | 'low';
  breakdown: { time: number; actions: number; sessions: number; breadth: number; errorPenalty: number };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function computeProductivity(i: ProductivityInputs): ProductivityResult {
  const time = Math.min(100, (i.activeMinutes / 240) * 100);     // ~4h focused work = 100
  const actions = Math.min(100, i.businessActions * 5);          // 20 business actions = 100
  const sessions = Math.min(100, i.sessions * 12);               // ~8 sessions = 100
  const breadth = Math.min(100, i.productsUsed * 25);            // 4 products = 100
  const errorPenalty = Math.min(30, i.errors * 5);              // capped penalty

  const score = clamp(Math.round(
    0.30 * time + 0.35 * actions + 0.20 * sessions + 0.15 * breadth - errorPenalty,
  ));
  const band: ProductivityResult['band'] = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    score,
    band,
    breakdown: {
      time: Math.round(time),
      actions: Math.round(actions),
      sessions: Math.round(sessions),
      breadth: Math.round(breadth),
      errorPenalty: Math.round(errorPenalty),
    },
  };
}
