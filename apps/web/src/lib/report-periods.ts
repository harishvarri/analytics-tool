/** Calendar-aligned period helpers for the Operations Report. No server-only deps. */

export type WeekNumber = 1 | 2 | 3 | 4;

export interface ReportPeriod {
  thisStart: Date;
  thisEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  periodLabel: 'Weekly' | 'Monthly';
  periodNoun: 'week' | 'month';
  /** e.g. "W2 · June 2026" or "June 2026" */
  displayLabel: string;
  /** e.g. "Jun 8–14" or "Jun 1–30" */
  dateRangeLabel: string;
  year: number;
  month: number;
  week: WeekNumber | null;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

export function monthName(m: number): string { return MONTHS[m - 1] ?? ''; }
export function monthShort(m: number): string { return MONTHS_SHORT[m - 1] ?? ''; }

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function dayToWeek(day: number): WeekNumber {
  return (day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4) as WeekNumber;
}

export function calendarWeekBounds(year: number, month: number, week: WeekNumber): [Date, Date] {
  const s = (week - 1) * 7 + 1;
  const e = week < 4 ? s + 6 : lastDayOfMonth(year, month);
  return [
    new Date(year, month - 1, s, 0, 0, 0, 0),
    new Date(year, month - 1, e, 23, 59, 59, 999),
  ];
}

export function calendarMonthBounds(year: number, month: number): [Date, Date] {
  return [
    new Date(year, month - 1, 1, 0, 0, 0, 0),
    new Date(year, month, 0, 23, 59, 59, 999),
  ];
}

function prevYM(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

function nextYM(year: number, month: number): [number, number] {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}

export function weekRangeLabel(year: number, month: number, week: WeekNumber): string {
  const s = (week - 1) * 7 + 1;
  const e = week < 4 ? s + 6 : lastDayOfMonth(year, month);
  return `${monthShort(month)} ${s}–${e}`;
}

export function getReportPeriod(year: number, month: number, week: WeekNumber | null): ReportPeriod {
  const [py, pm] = prevYM(year, month);
  if (week === null) {
    const [ts, te] = calendarMonthBounds(year, month);
    const [ps, pe] = calendarMonthBounds(py, pm);
    return {
      thisStart: ts, thisEnd: te, previousStart: ps, previousEnd: pe,
      periodLabel: 'Monthly', periodNoun: 'month',
      displayLabel: `${monthName(month)} ${year}`,
      dateRangeLabel: `${monthShort(month)} 1–${lastDayOfMonth(year, month)}`,
      year, month, week: null,
    };
  }
  const [ts, te] = calendarWeekBounds(year, month, week);
  const [ps, pe] = calendarWeekBounds(py, pm, week);
  return {
    thisStart: ts, thisEnd: te, previousStart: ps, previousEnd: pe,
    periodLabel: 'Weekly', periodNoun: 'week',
    displayLabel: `W${week} · ${monthName(month)} ${year}`,
    dateRangeLabel: weekRangeLabel(year, month, week),
    year, month, week,
  };
}

export function currentReportPeriod(): ReportPeriod {
  const now = new Date();
  return getReportPeriod(now.getFullYear(), now.getMonth() + 1, dayToWeek(now.getDate()));
}

/** Rolling window (for dashboard overview, not the full report page). */
export function rollingPeriod(days = 7): ReportPeriod {
  const now = new Date();
  const ts = new Date(now.getTime() - days * 86_400_000);
  const ps = new Date(now.getTime() - 2 * days * 86_400_000);
  const isMonthly = days >= 28;
  return {
    thisStart: ts, thisEnd: now, previousStart: ps, previousEnd: ts,
    periodLabel: isMonthly ? 'Monthly' : 'Weekly',
    periodNoun: isMonthly ? 'month' : 'week',
    displayLabel: isMonthly ? 'Last 30 days' : 'Last 7 days',
    dateRangeLabel: '',
    year: now.getFullYear(), month: now.getMonth() + 1, week: null,
  };
}

/** Build period navigator links. Returns prev/next year+month and a flag for whether next is in the future. */
export function periodNavLinks(year: number, month: number, week: WeekNumber | null) {
  const [py, pm] = prevYM(year, month);
  const [ny, nm] = nextYM(year, month);
  const weekParam = week === null ? 'month' : String(week);

  function href(y: number, m: number, w = weekParam) {
    return `/dashboard/insights?y=${y}&m=${m}&w=${w}`;
  }

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFutureMonth = new Date(year, month - 1) > new Date(now.getFullYear(), now.getMonth());

  return {
    prevMonthHref: href(py, pm),
    nextMonthHref: isFutureMonth ? null : href(ny, nm),
    currentWeekHref: (w: WeekNumber) => href(year, month, String(w)),
    monthlyHref: href(year, month, 'month'),
    isCurrentMonth,
    prevMonthName: `${monthShort(pm)} ${py}`,
    nextMonthName: `${monthShort(nm)} ${ny}`,
    lastDayOfCurrentMonth: lastDayOfMonth(year, month),
  };
}
