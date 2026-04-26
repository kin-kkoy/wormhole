import type { LoreMode } from '../../../state/store';

interface ModeToggleProps {
  mode: LoreMode;
  onChange: (mode: LoreMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="lore-mode-toggle" role="tablist" aria-label="Lore archive mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'read'}
        className={
          'lore-mode-toggle__pill' +
          (mode === 'read' ? ' lore-mode-toggle__pill--active' : '')
        }
        onClick={() => onChange('read')}
      >
        <svg className="lore-mode-toggle__icon" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 3.5v9l3-1.5 3 1.5 3-1.5 3 1.5v-9l-3-1.5-3 1.5-3-1.5L2 3.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M8 2v9" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </svg>
        Read
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'edit'}
        className={
          'lore-mode-toggle__pill' +
          (mode === 'edit' ? ' lore-mode-toggle__pill--active' : '')
        }
        onClick={() => onChange('edit')}
      >
        <svg className="lore-mode-toggle__icon" viewBox="0 0 16 16" fill="none">
          <path
            d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        Write
      </button>
    </div>
  );
}
