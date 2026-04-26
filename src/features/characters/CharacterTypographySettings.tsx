import { useEffect, useRef } from 'react';
import {
  FONT_LABELS,
  ROLE_CONFIG,
  ROLE_ORDER,
  type FontFamilyKey,
  type RoleKey,
  type TypographySettings,
} from '../../hooks/useCharacterTypography';
import './CharacterTypographySettings.css';

interface CharacterTypographySettingsProps {
  settings: TypographySettings;
  onChange: (next: TypographySettings) => void;
  onReset: () => void;
  onClose: () => void;
}

/** Modal dialog that lets the user pick font family + size for each role
 *  (Headings, Prose, Labels, KV Values). Changes apply live via CSS vars,
 *  so the underlying Codex updates as the user tweaks — close to commit. */
export function CharacterTypographySettings({
  settings,
  onChange,
  onReset,
  onClose,
}: CharacterTypographySettingsProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape key closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setRole(role: RoleKey, partial: Partial<TypographySettings[RoleKey]>) {
    onChange({
      ...settings,
      [role]: { ...settings[role], ...partial },
    });
  }

  return (
    <div className="char-type-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="char-type-dialog"
        role="dialog"
        aria-label="Character typography settings"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="char-type-dialog__header">
          <span className="char-type-dialog__eyebrow">Typography</span>
          <h2 className="char-type-dialog__title">Codex Type</h2>
          <button
            className="char-type-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Live preview reflects the current settings via CSS vars. */}
        <section className="char-type-preview">
          <div className="char-type-preview__name">Aria Brightwood</div>
          <p className="char-type-preview__prose">
            A wandering scribe with a memory for songs nobody else can recall.
          </p>
          <dl className="char-type-preview__kv">
            <div>
              <dt>Age</dt>
              <dd>24</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>The Hollow Coast</dd>
            </div>
          </dl>
        </section>

        <div className="char-type-rows">
          {ROLE_ORDER.map((role) => {
            const cfg = ROLE_CONFIG[role];
            const current = settings[role];
            const minRem = +(cfg.defaultSizeRem * cfg.scaleMin).toFixed(4);
            const maxRem = +(cfg.defaultSizeRem * cfg.scaleMax).toFixed(4);
            const stepRem = 0.0625;
            return (
              <div className="char-type-row" key={role}>
                <div className="char-type-row__head">
                  <span className="char-type-row__label">{cfg.label}</span>
                  <span className="char-type-row__desc">{cfg.description}</span>
                </div>
                <div className="char-type-row__controls">
                  <select
                    className="char-type-row__family"
                    value={current.family}
                    onChange={(e) =>
                      setRole(role, { family: e.target.value as FontFamilyKey })
                    }
                    style={{
                      fontFamily: getFontStackFor(current.family),
                    }}
                    aria-label={`${cfg.label} font family`}
                  >
                    {(Object.keys(FONT_LABELS) as FontFamilyKey[]).map((k) => (
                      <option key={k} value={k} style={{ fontFamily: getFontStackFor(k) }}>
                        {FONT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <div className="char-type-row__size">
                    <input
                      className="char-type-row__slider"
                      type="range"
                      min={minRem}
                      max={maxRem}
                      step={stepRem}
                      value={current.sizeRem}
                      onChange={(e) =>
                        setRole(role, { sizeRem: parseFloat(e.target.value) })
                      }
                      aria-label={`${cfg.label} size`}
                    />
                    <span className="char-type-row__size-value">
                      {Math.round(current.sizeRem * 16)}px
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="char-type-dialog__footer">
          <button className="char-type-dialog__reset" onClick={onReset}>
            Reset to defaults
          </button>
          <button className="char-type-dialog__done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Small helper so the <select> options render in their own font for preview. */
function getFontStackFor(key: FontFamilyKey): string {
  switch (key) {
    case 'cormorant':
      return "'Cormorant Garamond', Georgia, serif";
    case 'crimson':
      return "'Crimson Pro', Georgia, serif";
    case 'inter':
      return "'Inter', system-ui, sans-serif";
    case 'system-serif':
      return "Georgia, serif";
    case 'system-sans':
      return "system-ui, sans-serif";
  }
}
