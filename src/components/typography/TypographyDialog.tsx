// Packet 10 — shared typography settings modal. Powers the Lore
// gear popovers (same UX as the Character codex one): live preview + role rows
// (family + size) + Reset/Done footer. Generic over the system's role keys.

import { useEffect, type ReactNode } from 'react';
import { type FontFamilyKey } from '../../lib/font-catalog';
import type { RoleConfig, RoleSetting } from '../../lib/typography-core';
import { FontFamilyPicker } from './FontControls';
import './TypographyDialog.css';

interface Props<R extends string> {
  eyebrow: string;
  title: string;
  ariaLabel: string;
  roleConfig: Record<R, RoleConfig>;
  roleOrder: R[];
  settings: Record<R, RoleSetting>;
  onChange: (next: Record<R, RoleSetting>) => void;
  onReset: () => void;
  onClose: () => void;
  resetLabel?: string;
  preview: ReactNode;
  /** CSS color + "r, g, b" string for the dialog accent. Defaults to lore amber. */
  accent?: { color: string; rgb: string };
}

export function TypographyDialog<R extends string>({
  eyebrow,
  title,
  ariaLabel,
  roleConfig,
  roleOrder,
  settings,
  onChange,
  onReset,
  onClose,
  resetLabel = 'Reset to defaults',
  preview,
  accent,
}: Props<R>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setRole(role: R, partial: Partial<RoleSetting>) {
    onChange({ ...settings, [role]: { ...settings[role], ...partial } });
  }

  return (
    <div className="type-dialog-backdrop" onClick={onClose}>
      <div
        className="type-dialog"
        role="dialog"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={
          accent
            ? ({ '--type-accent': accent.color, '--type-accent-rgb': accent.rgb } as React.CSSProperties)
            : undefined
        }
      >
        <header className="type-dialog__header">
          <span className="type-dialog__eyebrow">{eyebrow}</span>
          <h2 className="type-dialog__title">{title}</h2>
          <button className="type-dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="type-dialog__preview">{preview}</section>

        <div className="type-dialog__rows">
          {roleOrder.map((role) => {
            const cfg = roleConfig[role];
            const current = settings[role];
            const minRem = +(cfg.defaultSizeRem * cfg.scaleMin).toFixed(4);
            const maxRem = +(cfg.defaultSizeRem * cfg.scaleMax).toFixed(4);
            return (
              <div className="type-dialog__row" key={role}>
                <div className="type-dialog__row-head">
                  <span className="type-dialog__row-label">{cfg.label}</span>
                  <span className="type-dialog__row-desc">{cfg.description}</span>
                </div>
                <div className="type-dialog__row-controls">
                  <FontFamilyPicker
                    value={current.family as FontFamilyKey}
                    onChange={(family) => setRole(role, { family })}
                    title={`${cfg.label} font family`}
                    className="type-dialog__family"
                  />
                  <div className="type-dialog__size">
                    <input
                      className="type-dialog__slider"
                      type="range"
                      min={minRem}
                      max={maxRem}
                      step={0.0625}
                      value={current.sizeRem}
                      onChange={(e) => setRole(role, { sizeRem: parseFloat(e.target.value) })}
                      aria-label={`${cfg.label} size`}
                    />
                    <span className="type-dialog__size-value">{Math.round(current.sizeRem * 16)}px</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="type-dialog__footer">
          <button className="type-dialog__reset" onClick={onReset}>
            {resetLabel}
          </button>
          <button className="type-dialog__done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
