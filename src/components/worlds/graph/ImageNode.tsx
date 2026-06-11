import { useState } from 'react';

interface ImageNodeProps {
  x: number;
  y: number;
  radius: number;
  imageUrl: string | null;
  fallbackType: 'map' | 'character' | 'document';
  dimmed: boolean;
  selected?: boolean;
  accentColor?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onHoverStart?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
}


export function ImageNode({
  x,
  y,
  radius,
  imageUrl,
  fallbackType: _fallbackType,
  dimmed,
  selected,
  accentColor = 'var(--border)',
  onClick,
  onContextMenu,
  onHoverStart,
  onHoverEnd,
}: ImageNodeProps) {
  const [clipId] = useState(() => `clip-${Math.random().toString(36).slice(2, 9)}`);

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
      <defs>
        <clipPath id={clipId}>
          <circle r={radius - 2} />
        </clipPath>
      </defs>

      {/* Background circle — constellation star */}
      <circle
        r={radius}
        fill="var(--bg-secondary)"
        stroke={selected ? 'var(--accent-overview)' : accentColor}
        strokeWidth={selected ? 2.5 : 1.3}
        strokeOpacity={selected ? 1 : 0.6}
        className="image-node__border"
      />

      {/* Core dot — the star's bright center */}
      <circle
        r={Math.max(3, radius * 0.14)}
        fill={accentColor}
        className="image-node__core"
      />

      {imageUrl && (
        <image
          href={imageUrl}
          x={-(radius - 2)}
          y={-(radius - 2)}
          width={(radius - 2) * 2}
          height={(radius - 2) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}
    </g>
  );
}
