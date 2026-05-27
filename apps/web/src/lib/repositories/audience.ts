import 'server-only';
import { getSupabaseAdmin } from '../supabase/admin';
import { AppError } from '../api/errors';

/**
 * Module H — Audience & Tech Analytics repository.
 *
 * Reads the audience_dimensions(p_days) SQL function (migration 0012), which
 * unpivots device/environment context already present in event metadata.
 */

export type AudienceDimension =
  | 'browser'
  | 'os'
  | 'device_type'
  | 'language'
  | 'timezone'
  | 'region'
  | 'screen';

export interface AudienceRow {
  dimension: AudienceDimension;
  value:     string;
  events:    number;
  users:     number;
  sessions:  number;
}

export interface AudienceBreakdown {
  /** All rows across every dimension */
  rows:    AudienceRow[];
  /** Grouped by dimension for easy rendering */
  byDimension: Record<AudienceDimension, AudienceRow[]>;
  /** Distinct users that carried device context in the window */
  totalUsers: number;
}

const EMPTY_BY_DIM: Record<AudienceDimension, AudienceRow[]> = {
  browser: [], os: [], device_type: [], language: [], timezone: [], region: [], screen: [],
};

export async function getAudienceBreakdown(days = 30): Promise<AudienceBreakdown> {
  const { data, error } = await getSupabaseAdmin().rpc('audience_dimensions', { p_days: days });

  if (error) throw new AppError('AUDIENCE_FAILED', error.message, 500);

  const rows: AudienceRow[] = ((data ?? []) as Array<{
    dimension: string; value: string; events: number; users: number; sessions: number;
  }>).map((r) => ({
    dimension: r.dimension as AudienceDimension,
    value:     r.value,
    events:    Number(r.events),
    users:     Number(r.users),
    sessions:  Number(r.sessions),
  }));

  const byDimension: Record<AudienceDimension, AudienceRow[]> = {
    browser: [], os: [], device_type: [], language: [], timezone: [], region: [], screen: [],
  };
  for (const r of rows) {
    (byDimension[r.dimension] ??= []).push(r);
  }

  // Total distinct users ≈ max users on the device_type dimension (every
  // device-context event carries device_type, so it covers the full audience).
  const totalUsers = (byDimension.device_type ?? []).reduce((sum, r) => sum + r.users, 0);

  return { rows, byDimension, totalUsers };
}

export { EMPTY_BY_DIM };
