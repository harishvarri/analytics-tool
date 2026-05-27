'use client';

import { AreaChart, type AreaSeries } from './AreaChart';

/**
 * 'use client' wrapper for the hourly error-rate area chart.
 * Owns its X/Y formatters so no functions cross the Server → Client boundary.
 */

interface Props {
  data:   ReadonlyArray<Record<string, unknown>>;
  xKey:   string;
  series: AreaSeries[];
  height?: number;
}

export function ErrorRateChart({ data, xKey, series, height }: Props) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <AreaChart
      data={data}
      xKey={xKey}
      series={series}
      formatX={(v) => new Date(String(v)).toLocaleTimeString('en-US', { hour: 'numeric' })}
      formatY={(v) => `${v}%`}
      {...heightProp}
    />
  );
}
