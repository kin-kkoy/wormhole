import { useState } from 'react';

interface ImageNodeProps {
  x: number;
  y: number;
  radius: number;
  imageUrl: string | null;
  fallbackType: 'map' | 'character' | 'document';
  dimmed: boolean;
  selected?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onHoverStart?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
}

const FALLBACK_ICONS: Record<string, string> = {
  map: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  character: 'M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z',
  document: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z',
};

export function ImageNode({
  x,
  y,
  radius,
  imageUrl,
  fallbackType,
  dimmed,
  selected,
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

      {/* Background circle */}
      <circle
        r={radius}
        fill="var(--bg-secondary)"
        stroke={selected ? 'var(--accent-overview)' : 'var(--border)'}
        strokeWidth={selected ? 2.5 : 1.5}
        className="image-node__border"
      />

      {imageUrl ? (
        <image
          href={imageUrl}
          x={-(radius - 2)}
          y={-(radius - 2)}
          width={(radius - 2) * 2}
          height={(radius - 2) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <g transform={`translate(${-radius * 0.4}, ${-radius * 0.4}) scale(${(radius * 0.8) / 24})`}>
          <path
            d={FALLBACK_ICONS[fallbackType]}
            fill="var(--text-muted)"
            opacity={0.5}
          />
        </g>
      )}
    </g>
  );
}
