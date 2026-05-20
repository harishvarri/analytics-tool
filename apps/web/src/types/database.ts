/**
 * NCPL Analytics — Postgres types for the `public` schema.
 *
 * Hand-written to match supabase/migrations/0001–0003. Once a real Supabase
 * project is connected, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 * Keep the file shape (`Database['public']['Tables']`/`Views`/`Enums`) — the
 * rest of the app consumes those slots.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---- Enums (mirror SQL CREATE TYPE) ----

export type PortalIdEnum =
  | 'sentinel'
  | 'analytics';

export type EventCategoryEnum =
  | 'auth'
  | 'navigation'
  | 'feature'
  | 'interaction'
  | 'error'
  | 'custom';

export type EventSourceEnum = 'web' | 'mobile' | 'server' | 'integration';

// ---- Row shapes ----

export interface AnalyticsUserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export interface AnalyticsPortalRow {
  id: PortalIdEnum;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface AnalyticsSessionRow {
  id: string;
  user_id: string | null;
  portal_id: PortalIdEnum;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  country_code: string | null;
  event_count: number;
  metadata: Json;
}

export interface AnalyticsEventRow {
  id: string;
  portal_id: PortalIdEnum;
  category: EventCategoryEnum;
  name: string;
  source: EventSourceEnum;
  user_id: string | null;
  session_id: string | null;
  url: string | null;
  referrer: string | null;
  metadata: Json;
  occurred_at: string;
  ingested_at: string;
}

export interface AnalyticsReportRow {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  query: Json;
  schedule_cron: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

// ---- View shapes ----

export interface RealtimeActivityRow {
  id: string;
  portal_id: PortalIdEnum;
  portal_name: string;
  category: EventCategoryEnum;
  event_name: string;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  session_id: string | null;
  url: string | null;
  metadata: Json;
  occurred_at: string;
}

export interface PortalDailyRow {
  portal_id: PortalIdEnum;
  day: string;
  events: number;
  users: number;
  sessions: number;
  errors: number;
}

export interface UserDailyRow {
  user_id: string;
  day: string;
  events: number;
  portals: number;
  sessions: number;
}

export interface FeatureUsage30dRow {
  portal_id: PortalIdEnum;
  event_name: string;
  occurrences: number;
  unique_users: number;
  unique_sessions: number;
}

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

// ---- Supabase Database root ----
export interface Database {
  public: {
    Tables: {
      analytics_users: Table<AnalyticsUserRow>;
      analytics_portals: Table<AnalyticsPortalRow>;
      analytics_sessions: Table<AnalyticsSessionRow>;
      analytics_events: Table<AnalyticsEventRow>;
      analytics_reports: Table<AnalyticsReportRow>;
    };
    Views: {
      v_realtime_activity: View<RealtimeActivityRow>;
      mv_portal_daily: View<PortalDailyRow>;
      mv_user_daily: View<UserDailyRow>;
      mv_feature_usage_30d: View<FeatureUsage30dRow>;
    };
    Functions: {
      is_analytics_admin: { Args: Record<string, never>; Returns: boolean };
      refresh_analytics_aggregates: { Args: Record<string, never>; Returns: void };
      ensure_events_partition: { Args: { p_month: string }; Returns: void };
    };
    Enums: {
      portal_id: PortalIdEnum;
      event_category: EventCategoryEnum;
      event_source: EventSourceEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}
