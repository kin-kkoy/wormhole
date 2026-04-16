import { crossLinkPath } from '../../../lib/graph-layout';

interface GraphLinkProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'hierarchy' | 'crosslink';
  dimmed: boolean;
}

export function GraphLink({ x1, y1, x2, y2, type, dimmed }: GraphLinkProps) {
  if (type === 'crosslink') {
    return (
      <path
        d={crossLinkPath(x1, y1, x2, y2)}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={dimmed ? 0.05 : 0.3}
      />
    );
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--border)"
      strokeWidth={1.5}
      opacity={dimmed ? 0.05 : 0.4}
    />
  );
}
