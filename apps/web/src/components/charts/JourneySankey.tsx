'use client';

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from 'recharts';

/**
 * 'use client' Sankey wrapper for customer-journey flow.
 * Receives a precomputed node/link graph (plain data) from a server component.
 */

interface SankeyNode {
  name: string;
  step: number;
}
interface SankeyLink {
  source: number;
  target: number;
  value: number;
}
interface Props {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
}

const STEP_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

// Custom node renderer — draws the bar + an outside label.
interface NodeRenderProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; step?: number };
  containerWidth: number;
}

function JourneyNode({ x, y, width, height, index, payload, containerWidth }: NodeRenderProps) {
  const isRightHalf = x + width + 6 > containerWidth - 120;
  const color = STEP_COLORS[((payload.step ?? 1) - 1) % STEP_COLORS.length];
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.95} radius={2} />
      <text
        x={isRightHalf ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isRightHalf ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={11}
        fill="hsl(var(--foreground))"
      >
        {payload.name}
      </text>
    </Layer>
  );
}

export function JourneySankey({ nodes, links, height = 420 }: Props) {
  // Recharts mutates the data object; pass fresh copies.
  const data = {
    nodes: nodes.map((n) => ({ name: n.name, step: n.step })),
    links: links.map((l) => ({ ...l })),
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodePadding={26}
        nodeWidth={12}
        linkCurvature={0.5}
        iterations={64}
        margin={{ top: 10, right: 140, bottom: 10, left: 10 }}
        node={(props: NodeRenderProps) => <JourneyNode {...props} />}
        link={{ stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.18 }}
      >
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
