import './HoverLabel.css';

interface HoverLabelProps {
  x: number;
  y: number;
  name: string;
  count?: number;
  subtitle?: string;
}

export function HoverLabel({ x, y, name, count, subtitle }: HoverLabelProps) {
  return (
    <div
      className="hover-label"
      style={{ left: x, top: y }}
    >
      <span className="hover-label__name">
        {name}
        {count != null && <span className="hover-label__count"> ({count})</span>}
      </span>
      {subtitle && (
        <span className="hover-label__subtitle">{subtitle}</span>
      )}
    </div>
  );
}
