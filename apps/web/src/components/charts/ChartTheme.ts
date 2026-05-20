/**
 * Chart color tokens. Map to HSL CSS vars where possible; Recharts requires
 * resolved strings, so we keep them as hex/hsl literals here.
 */
export const CHART_COLORS = {
  primary: 'hsl(217 91% 60%)',     // bright blue
  secondary: 'hsl(262 83% 64%)',   // violet
  emerald: 'hsl(160 84% 45%)',
  amber: 'hsl(38 92% 55%)',
  rose: 'hsl(347 89% 60%)',
  sky: 'hsl(199 89% 55%)',
  slate: 'hsl(215 16% 60%)',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
} as const;

export const PORTAL_COLOR: Record<string, string> = {
  sentinel: CHART_COLORS.secondary,
  analytics: CHART_COLORS.slate,
};

export const CATEGORY_COLOR: Record<string, string> = {
  auth: CHART_COLORS.primary,
  navigation: CHART_COLORS.sky,
  feature: CHART_COLORS.emerald,
  interaction: CHART_COLORS.secondary,
  error: CHART_COLORS.rose,
  custom: CHART_COLORS.amber,
};
