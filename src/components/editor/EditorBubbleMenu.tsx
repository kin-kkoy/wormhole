import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  FONT_CATEGORIES,
  FONT_LABELS,
  FONT_STACKS,
  matchFamilyKey,
  type FontFamilyKey,
} from '../../lib/font-catalog';
import './EditorBubbleMenu.css';

interface Props {
  editor: Editor | null;
}

const SIZE_PRESETS = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32];

/** Codex color palette (Packet 10 §4.4). Stored as `var(--codex-color-…)` so
 *  the mark adapts to the active theme. "Default" clears the color attribute. */
const CODEX_COLORS: { name: string; value: string }[] = [
  { name: 'Ink', value: 'var(--codex-color-ink)' },
  { name: 'Parchment', value: 'var(--codex-color-parchment)' },
  { name: 'Sepia', value: 'var(--codex-color-sepia)' },
  { name: 'Burgundy', value: 'var(--codex-color-burgundy)' },
  { name: 'Forest', value: 'var(--codex-color-forest)' },
  { name: 'Royal Indigo', value: 'var(--codex-color-indigo)' },
  { name: 'Pewter', value: 'var(--codex-color-pewter)' },
  { name: 'Gold Leaf', value: 'var(--codex-color-gold)' },
  { name: 'Sea Glass', value: 'var(--codex-color-seaglass)' },
  { name: 'Cinder', value: 'var(--codex-color-cinder)' },
];

const ALIGNMENTS: { value: 'left' | 'center' | 'right' | 'justify'; label: string; glyph: string }[] = [
  { value: 'left', label: 'Align left', glyph: '⬅' },
  { value: 'center', label: 'Align center', glyph: '⬌' },
  { value: 'right', label: 'Align right', glyph: '➡' },
  { value: 'justify', label: 'Justify', glyph: '☰' },
];

type DropdownKey = 'font' | 'size' | 'color' | 'align';

interface MenuPosition {
  visible: boolean;
  top: number;
  left: number;
}

/** Selection-triggered formatting menu. Subscribes to `selectionUpdate`,
 *  computes coords via `view.coordsAtPos`, portals to document.body so
 *  transformed ancestors don't shift its anchor. */
export function EditorBubbleMenu({ editor }: Props) {
  const [pos, setPos] = useState<MenuPosition>({ visible: false, top: 0, left: 0 });
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { state, view } = editor;
      const { from, to, empty } = state.selection;
      if (!editor.isEditable || empty) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
        setOpenDropdown(null);
        return;
      }
      try {
        const fromCoords = view.coordsAtPos(from);
        const toCoords = view.coordsAtPos(to);
        const left = (fromCoords.left + toCoords.right) / 2;
        const top = fromCoords.top;
        setPos({ visible: true, top, left });
      } catch {
        setPos((p) => (p.visible ? { ...p, visible: false } : p));
      }
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('focus', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('focus', update);
    };
  }, [editor]);

  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDropdown]);

  useEffect(() => {
    if (!openDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [openDropdown]);

  if (!editor || !pos.visible) return null;

  const attrs = editor.getAttributes('textStyle') as {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
  };
  const activeFamily = matchFamilyKey(attrs.fontFamily);
  const activeSize = parseSizePx(attrs.fontSize);
  const activeColor = attrs.color ?? null;
  const hasInlineMark = Boolean(attrs.fontFamily || attrs.fontSize || attrs.color);

  const setFamily = (key: FontFamilyKey) => {
    editor.chain().focus().setMark('textStyle', { ...attrs, fontFamily: FONT_STACKS[key] }).run();
    setOpenDropdown(null);
  };
  const setSize = (px: number) => {
    editor.chain().focus().setMark('textStyle', { ...attrs, fontSize: `${px}px` }).run();
    setOpenDropdown(null);
  };
  const setColor = (value: string | null) => {
    editor.chain().focus().setMark('textStyle', { ...attrs, color: value }).run();
    setOpenDropdown(null);
  };
  const resetFont = () => {
    editor.chain().focus().unsetMark('textStyle').run();
    setOpenDropdown(null);
  };

  return createPortal(
    <div
      ref={containerRef}
      className="editor-bubble"
      style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, calc(-100% - 8px))' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Font family */}
      <div className="editor-bubble__group">
        <button
          type="button"
          className="editor-bubble__select"
          onClick={() => setOpenDropdown(openDropdown === 'font' ? null : 'font')}
          style={{ fontFamily: activeFamily ? FONT_STACKS[activeFamily] : undefined }}
        >
          <span className="editor-bubble__select-label">
            {activeFamily ? FONT_LABELS[activeFamily] : 'Font'}
          </span>
          <span className="editor-bubble__caret">▾</span>
        </button>
        {openDropdown === 'font' && (
          <div className="editor-bubble__dropdown">
            {FONT_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div className="editor-bubble__dropdown-cat">{cat.label}</div>
                {cat.fonts.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`editor-bubble__dropdown-item ${
                      activeFamily === k ? 'editor-bubble__dropdown-item--active' : ''
                    }`}
                    style={{ fontFamily: FONT_STACKS[k] }}
                    onClick={() => setFamily(k)}
                  >
                    {FONT_LABELS[k]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Size */}
      <div className="editor-bubble__group">
        <button
          type="button"
          className="editor-bubble__select editor-bubble__select--narrow"
          onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
        >
          <span className="editor-bubble__select-label">{activeSize ?? '—'}</span>
          <span className="editor-bubble__caret">▾</span>
        </button>
        {openDropdown === 'size' && (
          <div className="editor-bubble__dropdown editor-bubble__dropdown--narrow">
            {SIZE_PRESETS.map((px) => (
              <button
                key={px}
                type="button"
                className={`editor-bubble__dropdown-item ${
                  activeSize === px ? 'editor-bubble__dropdown-item--active' : ''
                }`}
                onClick={() => setSize(px)}
              >
                {px}
              </button>
            ))}
            <div className="editor-bubble__custom-row">
              <input
                className="editor-bubble__custom-size"
                type="number"
                min={6}
                max={96}
                placeholder="custom"
                defaultValue={activeSize ?? ''}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = parseInt((e.target as HTMLInputElement).value, 10);
                    if (v >= 6 && v <= 96) setSize(v);
                  }
                }}
              />
              <span className="editor-bubble__custom-unit">px</span>
            </div>
          </div>
        )}
      </div>

      <div className="editor-bubble__separator" />

      {/* B / I / U / S */}
      <button
        type="button"
        className={`editor-bubble__icon-btn ${editor.isActive('bold') ? 'editor-bubble__icon-btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl/Cmd+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`editor-bubble__icon-btn ${editor.isActive('italic') ? 'editor-bubble__icon-btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl/Cmd+I)"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`editor-bubble__icon-btn ${editor.isActive('underline') ? 'editor-bubble__icon-btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl/Cmd+U)"
      >
        <span style={{ textDecoration: 'underline' }}>U</span>
      </button>
      <button
        type="button"
        className={`editor-bubble__icon-btn ${editor.isActive('strike') ? 'editor-bubble__icon-btn--active' : ''}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </button>

      <div className="editor-bubble__separator" />

      {/* Color */}
      <div className="editor-bubble__group">
        <button
          type="button"
          className={`editor-bubble__icon-btn ${activeColor ? 'editor-bubble__icon-btn--active' : ''}`}
          onClick={() => setOpenDropdown(openDropdown === 'color' ? null : 'color')}
          title="Text color"
        >
          <span className="editor-bubble__color-glyph" style={{ color: activeColor ?? 'currentColor' }}>
            A
          </span>
          <span className="editor-bubble__caret">▾</span>
        </button>
        {openDropdown === 'color' && (
          <div className="editor-bubble__dropdown editor-bubble__color-pop">
            <button
              type="button"
              className={`editor-bubble__color-default ${!activeColor ? 'is-active' : ''}`}
              onClick={() => setColor(null)}
            >
              Default
            </button>
            <div className="editor-bubble__color-grid">
              {CODEX_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`editor-bubble__color-swatch ${activeColor === c.value ? 'is-active' : ''}`}
                  style={{ background: c.value }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alignment */}
      <div className="editor-bubble__group">
        <button
          type="button"
          className="editor-bubble__icon-btn"
          onClick={() => setOpenDropdown(openDropdown === 'align' ? null : 'align')}
          title="Alignment"
        >
          <span>☰</span>
          <span className="editor-bubble__caret">▾</span>
        </button>
        {openDropdown === 'align' && (
          <div className="editor-bubble__dropdown editor-bubble__align-pop">
            {ALIGNMENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                className={`editor-bubble__icon-btn ${
                  editor.isActive({ textAlign: a.value }) ? 'editor-bubble__icon-btn--active' : ''
                }`}
                title={a.label}
                onClick={() => {
                  editor.chain().focus().setTextAlign(a.value).run();
                  setOpenDropdown(null);
                }}
              >
                {a.glyph}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="editor-bubble__separator" />

      <button
        type="button"
        className="editor-bubble__icon-btn editor-bubble__reset"
        disabled={!hasInlineMark}
        onClick={resetFont}
        title="Reset font, size & color"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 8 a 5 5 0 1 0 1.6 -3.7" />
          <path d="M2.5 3 v 3 h 3" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

function parseSizePx(stored: string | undefined): number | null {
  if (!stored) return null;
  const m = stored.match(/^([\d.]+)px$/);
  return m ? Math.round(parseFloat(m[1])) : null;
}
