'use server';

import { revalidatePath } from 'next/cache';
import { setIncidentStatus, type IncidentStatus } from '@/lib/repositories/incidents';
import { errorGroupKey } from '@/lib/repositories/reliabilityScore';

/** Revalidate every surface whose reliability/risk signals depend on incident
 *  or error-group lifecycle state. */
function revalidateReliabilitySurfaces() {
  revalidatePath('/dashboard/incidents');
  revalidatePath('/dashboard/health');
  revalidatePath('/dashboard/health/[slug]', 'page');
  revalidatePath('/dashboard/anomalies');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/insights');
  revalidatePath('/dashboard/errors');
}

/**
 * Server action: update an incident's lifecycle status, then revalidate every
 * surface whose reliability/risk signals depend on incident state — so closing
 * an incident instantly clears the degraded health, risk, and report signals
 * everywhere without a manual refresh.
 */
export async function updateIncidentStatus(incidentKey: string, status: IncidentStatus): Promise<{ ok: boolean }> {
  const ok = await setIncidentStatus(incidentKey, status);
  if (ok) revalidateReliabilitySurfaces();
  return { ok };
}

/**
 * Resolve/close a single error signature (group) from the Error Intelligence
 * tab. Stored in the same incident_status table under a fingerprint-derived key;
 * the health engine stops counting matching errors once resolved/closed.
 */
export async function updateErrorGroupStatus(fingerprint: string, status: IncidentStatus): Promise<{ ok: boolean }> {
  const ok = await setIncidentStatus(errorGroupKey(fingerprint), status);
  if (ok) revalidateReliabilitySurfaces();
  return { ok };
}
