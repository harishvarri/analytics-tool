'use client';

import {
  Area,
  AreaChart as ReAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS } from './ChartTheme';

export interface AreaSeries {
  dataKey: string;
  label: string;
  color?: string;
}

interface AreaChartProps {
  data: ReadonlyArray<Record<string, unknown>>;
  xKey: string;
  series: AreaSeries[];
  height?: number;
  formatX?: (value: string) => string;
  formatY?: (value: number) => string;
}

export function AreaChart({ data, xKey, series, height = 280, formatX, formatY }: AreaChartProps) {
  const xAxisProps = formatX ? { tickFormatter: formatX } : {};
  const yAxisProps = formatY ? { tickFormatter: formatY } : {};
  const tooltipProps = {
    ...(formatX ? { labelFormatter: formatX } : {}),
    ...(formatY ? { formatter: (v: number) => formatY(v) } : {}),
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={[...data]} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.dataKey} id={`grad-${i}-${s.dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? CHART_COLORS.primary} stopOpacity={0.4} />
              <stop offset="95%" stopColor={s.color ?? CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={CHART_COLORS.axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          {...xAxisProps}
        />
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
          {...tooltipProps}
        />
        {series.map((s, i) => (
          <Area
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.label}
            stroke={s.color ?? CHART_COLORS.primary}
            strokeWidth={2}
            fill={`url(#grad-${i}-${s.dataKey})`}
            isAnimationActive={false}
          />
        ))}
      </ReAreaChart>
    </ResponsiveContainer>
  );
}
