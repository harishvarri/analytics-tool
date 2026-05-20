'use client';

import { BarChart, type BarSeries } from './BarChart';

/**
 * Server-safe wrapper for the cycle-time per-status bar chart.
 * Owns its Y-axis formatter so no functions cross the Server→Client boundary.
 */
interface Props {
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  series: BarSeries[];
  height?: number;
}

export function WorkflowCycleChart({ data, xKey, series, height }: Props) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <BarChart
      data={data}
      xKey={xKey}
      series={series}
      formatY={(v) => `${v.toFixed(1)}h`}
      {...heightProp}
    />
  );
}
