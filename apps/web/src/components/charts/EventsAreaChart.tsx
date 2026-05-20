'use client';

import { AreaChart, type AreaSeries } from './AreaChart';

/**
 * Server-safe wrapper around AreaChart for the events/users time-series.
 * Defines its own formatters so no functions cross the Server → Client boundary.
 */

const fmt = new Intl.NumberFormat('en-US');

interface EventsAreaChartProps {
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  series: AreaSeries[];
  height?: number;
}

export function EventsAreaChart({ data, xKey, series, height }: EventsAreaChartProps) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <AreaChart
      data={data}
      xKey={xKey}
      series={series}
      formatX={(v) => new Date(String(v)).toLocaleTimeString('en-US', { hour: 'numeric' })}
      formatY={(v) => fmt.format(v)}
      {...heightProp}
    />
  );
}
