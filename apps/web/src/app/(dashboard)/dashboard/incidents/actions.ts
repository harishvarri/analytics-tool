'use server';

import { revalidatePath } from 'next/cache';
import { setIncidentStatus, type IncidentStatus } from '@/lib/repositories/incidents';

/** Server action: update an incident's lifecycle status and refresh the board. */
export async function updateIncidentStatus(incidentKey: string, status: IncidentStatus): Promise<{ ok: boolean }> {
  const ok = await setIncidentStatus(incidentKey, status);
  if (ok) revalidatePath('/dashboard/incidents');
  return { ok };
}
