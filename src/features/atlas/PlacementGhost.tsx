interface PlacementGhostProps {
  x: number;
  y: number;
  label: string;
  icon: string;
  accentColor: string;
  onConfirm: () => void;
  onCancel: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function PlacementGhost({
  x,
  y,
  label,
  icon,
  accentColor,
  onConfirm,
  onCancel,
  onPointerDown,
}: PlacementGhostProps) {
  return (
    <div
      className="atlas-marker atlas-marker--ghost"
      data-entity-drag
      style={{ left: x, top: y, borderColor: accentColor }}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="atlas-marker__disc">
        <span className="atlas-marker__icon" style={{ color: accentColor }}>
          {icon}
        </span>
      </div>
      <div className="atlas-marker__label">{label}</div>
      <div className="atlas-marker__actions" data-no-pan>
        <button
          className="btn btn--primary btn--tiny"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
        >
          Confirm
        </button>
        <button
          className="btn btn--ghost btn--tiny"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
