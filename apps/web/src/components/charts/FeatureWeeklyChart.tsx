'use client';

import { BarChart, type BarSeries } from './BarChart';

/**
 * 'use client' wrapper for the feature weekly-active-users stacked bar chart.
 * Owns its Y-axis label so no formatter functions cross the Server→Client boundary.
 */

interface Props {
  data:   ReadonlyArray<Record<string, unknown>>;
  xKey:   string;
  series: BarSeries[];
  height?: number;
}

export function FeatureWeeklyChart({ data, xKey, series, height }: Props) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <BarChart
      data={data}
      xKey={xKey}
      series={series}
      stacked
      formatY={(v) => String(v)}
      {...heightProp}
    />
  );
}
