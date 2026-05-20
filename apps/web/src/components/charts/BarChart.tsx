'use client';

import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS } from './ChartTheme';

export interface BarSeries {
  dataKey: string;
  label: string;
  color?: string;
}

interface BarChartProps {
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  series: BarSeries[];
  height?: number;
  stacked?: boolean;
  formatY?: (value: number) => string;
}

export function BarChart({ data, xKey, series, height = 280, stacked, formatY }: BarChartProps) {
  const yAxisProps = formatY ? { tickFormatter: formatY } : {};
  const tooltipProps = formatY ? { formatter: (v: number) => formatY(v) } : {};
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={[...data]} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} stroke={CHART_COLORS.axis} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke={CHART_COLORS.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          {...yAxisProps}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
          {...tooltipProps}
        />
        {series.map((s) => {
          const barProps = stacked ? { stackId: 'all' } : {};
          return (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.label}
              fill={s.color ?? CHART_COLORS.primary}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              {...barProps}
            />
          );
        })}
      </ReBarChart>
    </ResponsiveContainer>
  );
}
