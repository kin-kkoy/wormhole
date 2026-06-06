// Packet 10 — themed font-family / font-size pickers. Replaces native <select>
// (WebKitGTK renders those with OS colors that ignore the app theme). Used in
// the lore editor toolbar and the shared TypographyDialog. The menu portals to
// <body> with fixed positioning so it's never clipped by a scroll/overflow
// ancestor (e.g. the modal's `overflow: hidden`).

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FONT_CATEGORIES, FONT_LABELS, FONT_STACKS, type FontFamilyKey } from '../../lib/font-catalog';
import './FontControls.css';

interface MenuPos {
  top: number;
  left: number;
  minWidth: number;
}

/** Shared open/close + positioned-portal plumbing for a trigger + menu. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPos>({ top: 0, left: 0, minWidth: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, minWidth: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return { open, setOpen, triggerRef, menuRef, pos };
}

function Menu({
  menuRef,
  pos,
  children,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  pos: MenuPos;
  children: ReactNode;
}) {
  return createPortal(
    <div
      ref={menuRef}
      className="fontctl-menu"
      style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
      // Keep the editor selection intact when clicking inside the menu.
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

export function FontFamilyPicker({
  value,
  onChange,
  title,
  className = '',
}: {
  value: FontFamilyKey;
  onChange: (k: FontFamilyKey) => void;
  title?: string;
  className?: string;
}) {
  const { open, setOpen, triggerRef, menuRef, pos } = useMenu();
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`fontctl-trigger ${className}`}
        title={title ?? 'Font family'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ fontFamily: FONT_STACKS[value] }}
      >
        <span className="fontctl-trigger__label">{FONT_LABELS[value]}</span>
        <span className="fontctl-trigger__caret">▾</span>
      </button>
      {open && (
        <Menu menuRef={menuRef} pos={pos}>
          {FONT_CATEGORIES.map((cat) => (
            <div key={cat.label} className="fontctl-group">
              <div className="fontctl-group__label">{cat.label}</div>
              {cat.fonts.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`fontctl-item ${k === value ? 'is-active' : ''}`}
                  style={{ fontFamily: FONT_STACKS[k] }}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                >
                  {FONT_LABELS[k]}
                </button>
              ))}
            </div>
          ))}
        </Menu>
      )}
    </>
  );
}

const DEFAULT_SIZES = [12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32];

export function FontSizePicker({
  valuePx,
  onChange,
  presets = DEFAULT_SIZES,
  title,
  className = '',
}: {
  valuePx: number;
  onChange: (px: number) => void;
  presets?: number[];
  title?: string;
  className?: string;
}) {
  const { open, setOpen, triggerRef, menuRef, pos } = useMenu();
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`fontctl-trigger fontctl-trigger--size ${className}`}
        title={title ?? 'Font size'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="fontctl-trigger__label">{valuePx}</span>
        <span className="fontctl-trigger__caret">▾</span>
      </button>
      {open && (
        <Menu menuRef={menuRef} pos={pos}>
          <div className="fontctl-sizes">
            {presets.map((px) => (
              <button
                key={px}
                type="button"
                className={`fontctl-item fontctl-item--size ${px === valuePx ? 'is-active' : ''}`}
                onClick={() => {
                  onChange(px);
                  setOpen(false);
                }}
              >
                {px}
              </button>
            ))}
          </div>
          <div className="fontctl-custom">
            <input
              type="number"
              min={8}
              max={96}
              defaultValue={valuePx}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (v >= 8 && v <= 96) {
                    onChange(v);
                    setOpen(false);
                  }
                }
              }}
            />
            <span>px</span>
          </div>
        </Menu>
      )}
    </>
  );
}
