import 'server-only';
import type {
  DashboardKpis,
  PortalSummary,
  RealtimeActivityItem,
  SessionSummary,
  PortalId,
  EventCategory,
} from '@/types/analytics';
import type { UserActivityRow } from '@/lib/repositories/analytics';

/**
 * Deterministic-ish mock data so the dashboard always renders cleanly in dev
 * or when no Supabase project is connected. The shapes match the real
 * repository return types exactly — switching to live data is a one-line
 * change in the page server components.
 */

const PORTAL_IDS: PortalId[] = [
  'sentinel',
];

const EVENT_NAMES_BY_CATEGORY: Record<EventCategory, string[]> = {
  auth: ['auth.login', 'auth.logout', 'auth.session_start'],
  navigation: ['navigation.page_view', 'navigation.route_change'],
  feature: [
    'feature.used',
    'feature.viewed',
    'feature.completed',
    'feature.exported',
  ],
  interaction: ['interaction.button_click', 'interaction.form_submit'],
  error: ['error.captured'],
  custom: ['custom.search', 'custom.export'],
};

// Seeded RNG so the same render produces the same numbers within a request.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260520);
const rng = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;

export function mockDashboardKpis(): DashboardKpis {
  const totalEvents = rng(45_000, 90_000);
  const errors = rng(40, 160);
  return {
    activeUsers: rng(220, 480),
    totalSessions: rng(900, 1800),
    totalEvents,
    errorRate: errors / totalEvents,
  };
}

export function mockPortalSummaries(): PortalSummary[] {
  return PORTAL_IDS.map((portalId) => {
    const events = rng(4_000, 18_000);
    const errors = rng(2, 30);
    return {
      portalId,
      events24h: events,
      users24h: rng(40, 220),
      sessions24h: rng(120, 480),
      errors24h: errors,
    };
  });
}

export interface TimePoint {
  ts: string;
  events: number;
  users: number;
}

/** 24 points over the last 24h — one per hour. */
export function mockEventsTimeSeries(hours = 24): TimePoint[] {
  const now = Date.now();
  const points: TimePoint[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const ts = new Date(now - i * 60 * 60 * 1000).toISOString();
    // Sine-ish shape with noise — business-hours bump.
    const hour = new Date(ts).getUTCHours();
    const bell = 0.5 + 0.5 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
    points.push({
      ts,
      events: Math.round(800 + bell * 2400 + rng(-200, 200)),
      users: Math.round(30 + bell * 120 + rng(-15, 15)),
    });
  }
  return points;
}

export function mockCategoryBreakdown(): { category: EventCategory; events: number }[] {
  return (Object.keys(EVENT_NAMES_BY_CATEGORY) as EventCategory[]).map((c) => ({
    category: c,
    events:
      c === 'feature'
        ? rng(18_000, 32_000)
        : c === 'navigation'
          ? rng(20_000, 35_000)
          : c === 'interaction'
            ? rng(6_000, 14_000)
            : c === 'auth'
              ? rng(2_000, 6_000)
              : c === 'error'
                ? rng(80, 280)
                : rng(400, 2_000),
  }));
}

export function mockRecentActivity(limit = 20): RealtimeActivityItem[] {
  const now = Date.now();
  const items: RealtimeActivityItem[] = [];
  for (let i = 0; i < limit; i++) {
    const category = pick(['feature', 'navigation', 'interaction', 'auth', 'error'] as const);
    const portalId = pick(PORTAL_IDS);
    const occurredAt = new Date(now - i * rng(800, 9000)).toISOString();
    items.push({
      id: `evt_${i}_${rng(1000, 9999)}`,
      portalId,
      portalName: portalNameFor(portalId),
      category,
      eventName: pick(EVENT_NAMES_BY_CATEGORY[category]),
      userId: rand() > 0.15 ? `usr_${rng(1, 250)}` : null,
      userEmail: rand() > 0.4 ? `user${rng(1, 250)}@ncpl.internal` : null,
      userDisplayName: rand() > 0.4 ? pick(MOCK_NAMES) : null,
      sessionId: `ses_${rng(10_000, 99_999)}`,
      url: pick(MOCK_URLS),
      occurredAt,
    });
  }
  return items;
}

export function mockActiveUsers(limit = 12): UserActivityRow[] {
  const items: UserActivityRow[] = [];
  for (let i = 0; i < limit; i++) {
    const name = pick(MOCK_NAMES);
    items.push({
      userId: `usr_${rng(1, 250)}`,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@ncpl.internal`,
      displayName: name,
      lastSeenAt: new Date(Date.now() - rng(60, 3600 * 6) * 1000).toISOString(),
      events24h: rng(8, 380),
    });
  }
  return items.sort((a, b) => b.events24h - a.events24h);
}

export function mockRecentSessions(limit = 20): SessionSummary[] {
  const now = Date.now();
  const items: SessionSummary[] = [];
  for (let i = 0; i < limit; i++) {
    const started = now - rng(60, 3600 * 8) * 1000;
    items.push({
      sessionId: `ses_${rng(10_000, 99_999)}`,
      userId: rand() > 0.1 ? `usr_${rng(1, 250)}` : null,
      portalId: pick(PORTAL_IDS),
      startedAt: new Date(started).toISOString(),
      lastSeenAt: new Date(started + rng(60, 3600) * 1000).toISOString(),
      endedAt: rand() > 0.5 ? new Date(started + rng(120, 5400) * 1000).toISOString() : null,
      eventCount: rng(2, 180),
    });
  }
  return items;
}

const MOCK_NAMES = [
  'Aanya Reddy', 'Karthik Iyer', 'Sneha Pillai', 'Rohan Mehta', 'Priya Nair',
  'Vikram Shetty', 'Anushka Joshi', 'Aditya Rao', 'Meera Kapoor', 'Aryan Singh',
  'Ishita Verma', 'Devansh Patel', 'Lakshmi Menon', 'Tanvi Bhatt', 'Yash Kulkarni',
  'Neha Bansal', 'Siddharth Gupta', 'Pooja Krishnan',
];

const MOCK_URLS = [
  '/dashboard',
  '/sentinel/overview',
  '/sentinel/alerts',
  '/sentinel/settings',
  '/sentinel/reports',
  '/settings',
  '/profile',
];

function portalNameFor(id: PortalId): string {
  switch (id) {
    case 'sentinel': return 'Sentinel';
    case 'analytics': return 'Analytics Platform';
  }
}
