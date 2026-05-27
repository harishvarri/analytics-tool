'use client';

import { BarChart, type BarSeries } from './BarChart';

/** 'use client' wrapper for the daily page-load trend (ms Y-axis). */
interface Props {
  data:   ReadonlyArray<Record<string, unknown>>;
  xKey:   string;
  series: BarSeries[];
  height?: number;
}

export function PerfTrendChart({ data, xKey, series, height }: Props) {
  const heightProp = height !== undefined ? { height } : {};
  return (
    <BarChart data={data} xKey={xKey} series={series} formatY={(v) => `${Math.round(v)}ms`} {...heightProp} />
  );
}
