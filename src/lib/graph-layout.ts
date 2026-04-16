/**
 * Radial tree layout engine for the overview graphs.
 * Deterministic (no physics) — positions are computed from tree structure.
 */

export interface LayoutNode {
  id: string;
  children: LayoutNode[];
  collapsed: boolean;
  /** Set true for square nodes (shared nodes, folders) */
  isGroup: boolean;
}

export interface LayoutPosition {
  x: number;
  y: number;
}

export interface LayoutConfig {
  /** Pixels between concentric levels */
  levelSpacing: number;
  /** Minimum angular gap (radians) between sibling subtrees */
  minSiblingAngle: number;
  /** Start angle for the entire layout (radians) */
  startAngle: number;
  /** End angle for the entire layout (radians) */
  endAngle: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  levelSpacing: 130,
  minSiblingAngle: 0.15,
  startAngle: 0,
  endAngle: Math.PI * 2,
};

/** Count visible descendants (respecting collapse state) */
function subtreeSize(node: LayoutNode): number {
  if (node.collapsed || node.children.length === 0) {
    return 1;
  }
  let count = 1;
  for (const child of node.children) {
    count += subtreeSize(child);
  }
  return count;
}

/** Layout a single root tree, returns positions keyed by node ID */
function layoutTree(
  root: LayoutNode,
  level: number,
  angleStart: number,
  angleEnd: number,
  config: LayoutConfig,
  result: Map<string, LayoutPosition>,
) {
  const midAngle = (angleStart + angleEnd) / 2;
  const radius = level * config.levelSpacing;

  result.set(root.id, {
    x: Math.cos(midAngle) * radius,
    y: Math.sin(midAngle) * radius,
  });

  if (root.collapsed || root.children.length === 0) {
    return;
  }

  const totalSize = root.children.reduce((sum, c) => sum + subtreeSize(c), 0);
  const angleRange = angleEnd - angleStart;

  let currentAngle = angleStart;
  for (const child of root.children) {
    const childSize = subtreeSize(child);
    const childAngle = Math.max(
      (childSize / totalSize) * angleRange,
      config.minSiblingAngle,
    );

    layoutTree(
      child,
      level + 1,
      currentAngle,
      currentAngle + childAngle,
      config,
      result,
    );

    currentAngle += childAngle;
  }
}

/**
 * Compute positions for multiple root nodes arranged radially.
 * Each root gets an equal angular sector (or proportional to subtree size).
 */
export function computeRadialLayout(
  roots: LayoutNode[],
  config: Partial<LayoutConfig> = {},
): Map<string, LayoutPosition> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result = new Map<string, LayoutPosition>();

  if (roots.length === 0) return result;

  // Single root: place at center, children fan out
  if (roots.length === 1) {
    const root = roots[0];
    result.set(root.id, { x: 0, y: 0 });

    if (!root.collapsed && root.children.length > 0) {
      const totalSize = root.children.reduce((sum, c) => sum + subtreeSize(c), 0);
      const angleRange = cfg.endAngle - cfg.startAngle;

      let currentAngle = cfg.startAngle;
      for (const child of root.children) {
        const childSize = subtreeSize(child);
        const childAngle = Math.max(
          (childSize / totalSize) * angleRange,
          cfg.minSiblingAngle,
        );

        layoutTree(child, 1, currentAngle, currentAngle + childAngle, cfg, result);
        currentAngle += childAngle;
      }
    }

    return result;
  }

  // Multiple roots: distribute evenly around center
  const totalSize = roots.reduce((sum, r) => sum + subtreeSize(r), 0);
  const angleRange = cfg.endAngle - cfg.startAngle;

  let currentAngle = cfg.startAngle;
  for (const root of roots) {
    const rootSize = subtreeSize(root);
    const rootAngle = Math.max(
      (rootSize / totalSize) * angleRange,
      cfg.minSiblingAngle,
    );

    layoutTree(root, 1, currentAngle, currentAngle + rootAngle, cfg, result);
    currentAngle += rootAngle;
  }

  return result;
}

/**
 * Build a bezier curve path for cross-branch connections.
 * Uses a quadratic bezier with control point at the midpoint, offset perpendicular to the line.
 */
export function crossLinkPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Perpendicular offset
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(len * 0.2, 40);
  const cx = mx + (-dy / len) * offset;
  const cy = my + (dx / len) * offset;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}
