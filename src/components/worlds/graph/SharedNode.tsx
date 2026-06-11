interface SharedNodeProps {
  x: number;
  y: number;
  size: number;
  name: string;
  color: string | null;
  fontStyle: string;
  fontSize: number;
  dimmed: boolean;
  collapsed: boolean;
  memberCount: number;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onHoverStart?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
}

export function SharedNode({
  x,
  y,
  size,
  name,
  color,
  fontStyle,
  fontSize,
  dimmed,
  collapsed,
  memberCount,
  onClick,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
}: SharedNodeProps) {
  const fill = color ?? 'var(--bg-tertiary)';
  const half = size / 2;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      opacity={dimmed ? 0.15 : 1}
    >
      {/* Square with rounded corners — hover brightens this same shape
       *  (no surrounding halo ring; see GraphCanvas.css). */}
      <rect
        x={-half}
        y={-half}
        width={size}
        height={size}
        rx={6}
        fill={fill}
        fillOpacity={0.15}
        stroke={fill}
        strokeWidth={1.5}
        strokeOpacity={0.5}
        className="shared-node__box"
      />

      {/* Label text */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-primary)"
        fontSize={Math.min(fontSize, size * 0.3)}
        fontStyle={fontStyle === 'italic' ? 'italic' : 'normal'}
        fontWeight={fontStyle === 'bold' ? 700 : 400}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {name.length > 14 ? name.slice(0, 13) + '...' : name}
      </text>

      {/* Collapse indicator */}
      {collapsed && (
        <text
          x={half - 8}
          y={-half + 12}
          fontSize={12}
          fill="var(--text-muted)"
          style={{ pointerEvents: 'none' }}
        >
          +{memberCount}
        </text>
      )}
    </g>
  );
}
