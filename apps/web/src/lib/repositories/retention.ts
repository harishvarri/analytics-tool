import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module D — User Behavior & Retention repository.
 * All views created by migration 0008. No AI, no ML — pure SQL cohorts.
 */

export interface RetentionCohort {
  cohortWeek: string;
  cohortSize: number;
  d1Active:   number;
  d7Active:   number;
  d30Active:  number;
  d1Pct:      number;
  d7Pct:      number;
  d30Pct:     number;
}

export interface DormantUser {
  userId:           string;
  email:            string | null;
  displayName:      string | null;
  lastSeenAt:       string;
  daysSinceActive:  number;
}

export interface JourneyEdge {
  fromEvent:    string;
  toEvent:      string;
  transitions:  number;
}

export async function getRetentionCohorts(): Promise<RetentionCohort[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_retention_cohorts')
    .select('*');

  if (error) throw new AppError('RETENTION_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    cohort_week: string; cohort_size: number;
    d1_active: number; d7_active: number; d30_active: number;
    d1_pct: number | null; d7_pct: number | null; d30_pct: number | null;
  }>).map((r) => ({
    cohortWeek: r.cohort_week,
    cohortSize: Number(r.cohort_size),
    d1Active:   Number(r.d1_active),
    d7Active:   Number(r.d7_active),
    d30Active:  Number(r.d30_active),
    d1Pct:      Number(r.d1_pct ?? 0),
    d7Pct:      Number(r.d7_pct ?? 0),
    d30Pct:     Number(r.d30_pct ?? 0),
  }));
}

export async function getDormantUsers(limit = 25): Promise<DormantUser[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_dormant_users')
    .select('*')
    .limit(limit);

  if (error) throw new AppError('DORMANT_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    user_id: string; email: string | null; display_name: string | null;
    last_seen_at: string; days_since_active: number;
  }>).map((r) => ({
    userId:          r.user_id,
    email:           r.email,
    displayName:     r.display_name,
    lastSeenAt:      r.last_seen_at,
    daysSinceActive: Number(r.days_since_active),
  }));
}

export async function getTopJourneys(limit = 12): Promise<JourneyEdge[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('v_top_journeys')
    .select('*')
    .limit(limit);

  if (error) throw new AppError('JOURNEYS_FAILED', error.message, 500);

  return ((data ?? []) as Array<{
    from_event: string; to_event: string; transitions: number;
  }>).map((r) => ({
    fromEvent:   r.from_event,
    toEvent:     r.to_event,
    transitions: Number(r.transitions),
  }));
}
