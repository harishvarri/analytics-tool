'use client';

import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from './ChartTheme';

/**
 * BUG-013 fix: the old code built the SVG gradient id from the raw color string
 * (e.g. "hsl(217 91% 60%)"). Parentheses and spaces in a url(#id) reference
 * terminate the fragment, so the fill never rendered. useId() produces a valid,
 * guaranteed-unique id per instance, also fixing the duplicate-id issue when
 * the same color is used on multiple sparklines on the same page.
 */

interface SparklineProps {
  data: ReadonlyArray<{ value: number }>;
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = CHART_COLORS.primary, height = 40 }: SparklineProps) {
  const gradId = useId().replace(/:/g, '-'); // useId may include colons; sanitize for SVG
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={[...data]} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
