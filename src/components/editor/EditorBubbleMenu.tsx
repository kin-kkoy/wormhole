import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  FONT_LABELS,
  FONT_STACKS,
  type FontFamilyKey,
} from '../../hooks/useCharacterTypography';
import './EditorBubbleMenu.css';

interface Props {
  editor: Editor | null;
}

const SIZE_PRESETS = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32];

interface MenuPosition {
  visible: boolean;
  top: number;
  left: number;
}

/** Selection-triggered formatting menu. Mirrors the existing autocomplete
 *  pattern: subscribes to `selectionUpdate`, computes coords via
 *  `view.coordsAtPos`, portals to document.body so transformed ancestors
 *  (e.g. the character flip container's rotateY) don't shift its anchor. */
export function EditorBubbleMenu({ editor }: Props) {
  const [pos, setPos] = useState<MenuPosition>({ visible: false, top: 0, left: 0 });
  const [openDropdown, setOpenDropdown] = useState<'font' | 'size' | null>(null);
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

  // Escape closes any open dropdown; second Escape blurs. We just collapse
  // dropdowns here — the menu itself hides via selectionUpdate when the
  // user clicks elsewhere and the selection collapses.
  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDropdown]);

  // Close dropdown on outside click. We don't hide the menu itself — the
  // editor's selectionUpdate handles that when selection collapses.
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
  };
  const activeFamily = matchFamilyKey(attrs.fontFamily);
  const activeSize = parseSizePx(attrs.fontSize);
  const hasInlineMark = Boolean(attrs.fontFamily || attrs.fontSize);

  // setMark replaces the entire mark's attrs at the selection — to keep
  // family and size independent we merge the existing attrs in.
  const setFamily = (key: FontFamilyKey) => {
    editor
      .chain()
      .focus()
      .setMark('textStyle', { ...attrs, fontFamily: FONT_STACKS[key] })
      .run();
    setOpenDropdown(null);
  };
  const setSize = (px: number) => {
    editor
      .chain()
      .focus()
      .setMark('textStyle', { ...attrs, fontSize: `${px}px` })
      .run();
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
      style={{
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, calc(-100% - 8px))',
      }}
      // Prevent the editor from losing its selection when the user clicks
      // anywhere on the menu chrome.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="editor-bubble__group">
        <button
          type="button"
          className="editor-bubble__select"
          onClick={() => setOpenDropdown(openDropdown === 'font' ? null : 'font')}
          style={{
            fontFamily: activeFamily ? FONT_STACKS[activeFamily] : undefined,
          }}
        >
          <span className="editor-bubble__select-label">
            {activeFamily ? FONT_LABELS[activeFamily] : 'Font'}
          </span>
          <span className="editor-bubble__caret">▾</span>
        </button>
        {openDropdown === 'font' && (
          <div className="editor-bubble__dropdown">
            {(Object.keys(FONT_LABELS) as FontFamilyKey[]).map((k) => (
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
        )}
      </div>

      <div className="editor-bubble__group">
        <button
          type="button"
          className="editor-bubble__select editor-bubble__select--narrow"
          onClick={() => setOpenDropdown(openDropdown === 'size' ? null : 'size')}
        >
          <span className="editor-bubble__select-label">
            {activeSize ?? '—'}
          </span>
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

      <button
        type="button"
        className={`editor-bubble__icon-btn ${
          editor.isActive('bold') ? 'editor-bubble__icon-btn--active' : ''
        }`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl/Cmd+B)"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`editor-bubble__icon-btn ${
          editor.isActive('italic') ? 'editor-bubble__icon-btn--active' : ''
        }`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl/Cmd+I)"
      >
        <em>I</em>
      </button>

      <div className="editor-bubble__separator" />

      <button
        type="button"
        className="editor-bubble__icon-btn editor-bubble__reset"
        disabled={!hasInlineMark}
        onClick={resetFont}
        title="Reset font"
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

/** Match the stored font stack to one of our 5 known keys by checking the
 *  first canonical family. Tolerant of single/double quotes and whitespace. */
function matchFamilyKey(stored: string | undefined): FontFamilyKey | null {
  if (!stored) return null;
  const s = stored.trim();
  if (/^['"]Cormorant Garamond['"]/.test(s)) return 'cormorant';
  if (/^['"]Crimson Pro['"]/.test(s)) return 'crimson';
  if (/^['"]Inter['"]/.test(s)) return 'inter';
  if (/^['"]Iowan Old Style['"]/.test(s)) return 'system-serif';
  if (/^ui-sans-serif/.test(s)) return 'system-sans';
  return null;
}

function parseSizePx(stored: string | undefined): number | null {
  if (!stored) return null;
  const m = stored.match(/^([\d.]+)px$/);
  return m ? Math.round(parseFloat(m[1])) : null;
}
