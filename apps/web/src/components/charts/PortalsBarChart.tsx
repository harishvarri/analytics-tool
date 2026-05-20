'use client';

import { BarChart, type BarSeries } from './BarChart';

/**
 * Server-safe wrapper around BarChart for the portals comparison chart.
 * Defines its own formatter so no functions cross the Server → Client boundary.
 */

const fmt = new Intl.NumberFormat('en-US');

interface PortalsBarChartProps {
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  series: BarSeries[];
  height?: number;
}

export function PortalsBarChart({ data, xKey, series, height }: PortalsBarChartProps) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <BarChart
      data={data}
      xKey={xKey}
      series={series}
      formatY={(v) => fmt.format(v)}
      {...heightProp}
    />
  );
}
