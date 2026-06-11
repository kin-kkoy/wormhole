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
        stroke="rgba(196, 181, 154, 0.18)"
        strokeWidth={0.8}
        strokeDasharray="4 3"
        opacity={dimmed ? 0.05 : 1}
      />
    );
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="rgba(196, 181, 154, 0.13)"
      strokeWidth={1}
      opacity={dimmed ? 0.05 : 1}
    />
  );
}
