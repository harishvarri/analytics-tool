'use server';

import { revalidatePath } from 'next/cache';
import { setIncidentStatus, type IncidentStatus } from '@/lib/repositories/incidents';

/**
 * Server action: update an incident's lifecycle status, then revalidate every
 * surface whose reliability/risk signals depend on incident state — so closing
 * an incident instantly clears the degraded health, risk, and report signals
 * everywhere without a manual refresh.
 */
export async function updateIncidentStatus(incidentKey: string, status: IncidentStatus): Promise<{ ok: boolean }> {
  const ok = await setIncidentStatus(incidentKey, status);
  if (ok) {
    // Incident board itself.
    revalidatePath('/dashboard/incidents');
    // Reliability health (overview + every product analysis page).
    revalidatePath('/dashboard/health');
    revalidatePath('/dashboard/health/[slug]', 'page');
    // Risk & Anomaly, Executive Dashboard, Weekly Report, Error Center.
    revalidatePath('/dashboard/anomalies');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/insights');
    revalidatePath('/dashboard/errors');
  }
  return { ok };
}
