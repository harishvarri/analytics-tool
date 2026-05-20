'use client';

import { AreaChart, type AreaSeries } from './AreaChart';

/**
 * Weekly throughput area chart. Owns its formatters client-side so the page
 * stays a pure server component.
 */
interface Props {
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  series: AreaSeries[];
  height?: number;
}

export function WorkflowThroughputChart({ data, xKey, series, height }: Props) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <AreaChart
      data={data}
      xKey={xKey}
      series={series}
      formatX={(v) => {
        // ISO date → "MMM dd"
        const d = new Date(String(v));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }}
      formatY={(v) => String(Math.round(v))}
      {...heightProp}
    />
  );
}
