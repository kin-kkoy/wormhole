import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LinkableRecord } from '../../lib/commands';
import { commands } from '../../lib/commands';
import type { EntityType } from '../linking/LinkPickerDialog';
import {
  InlineLinkNode,
  detectBracketTrigger,
  insertInlineLink,
} from './InlineLinkExtension';
import { TextStyleWithFontSize } from './TextStyleWithFontSize';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import './TipTapEditor.css';

interface TipTapEditorProps {
  content: string;
  onUpdate: (json: string) => void;
  editable: boolean;
  placeholder?: string;
  className?: string;
  /** When set, enables `[[` autocomplete that lets the user insert inline
   *  links. Results exclude the provided source entity (can't self-link). */
  linkSource?: { type: EntityType; id: string };
}

interface AutocompleteState {
  visible: boolean;
  coords: { left: number; top: number; bottom: number };
  query: string;
  results: LinkableRecord[];
  selectedIndex: number;
  startPos: number;
}

const INITIAL_AUTOCOMPLETE: AutocompleteState = {
  visible: false,
  coords: { left: 0, top: 0, bottom: 0 },
  query: '',
  results: [],
  selectedIndex: 0,
  startPos: 0,
};

export function TipTapEditor({
  content,
  onUpdate,
  editable,
  placeholder,
  className = '',
  linkSource,
}: TipTapEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingJsonRef = useRef<string | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const flushPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingJsonRef.current !== null) {
      const json = pendingJsonRef.current;
      pendingJsonRef.current = null;
      onUpdateRef.current(json);
    }
  }, []);

  const debouncedUpdate = useCallback((json: string) => {
    pendingJsonRef.current = json;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (pendingJsonRef.current !== null) {
        const pending = pendingJsonRef.current;
        pendingJsonRef.current = null;
        onUpdateRef.current(pending);
      }
    }, 1000);
  }, []);

  // ─── Inline-link autocomplete ──────────────────────────────────────────────
  const autocompleteEnabled = editable && !!linkSource;
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(INITIAL_AUTOCOMPLETE);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acRef = useRef(autocomplete);
  acRef.current = autocomplete;
  // Keep linkSource in a ref so the autocomplete callbacks don't churn.
  const linkSourceRef = useRef(linkSource);
  linkSourceRef.current = linkSource;

  const hideAutocomplete = useCallback(() => {
    setAutocomplete(INITIAL_AUTOCOMPLETE);
  }, []);

  const doSearch = useCallback((query: string) => {
    const src = linkSourceRef.current;
    if (!src) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await commands.searchLinkableRecords({
          query,
          excludeType: src.type,
          excludeId: src.id,
        });
        setAutocomplete((prev) => (prev.visible ? { ...prev, results, selectedIndex: 0 } : prev));
      } catch (e) {
        console.error('Search failed:', e);
      }
    }, 150);
  }, []);

  const checkForBracketTrigger = useCallback((editorInstance: Editor | null) => {
    if (!editorInstance) return;
    const { state, view } = editorInstance;
    const trigger = detectBracketTrigger(state.doc, state.selection.from);
    if (trigger) {
      const coords = view.coordsAtPos(state.selection.from);
      setAutocomplete((prev) => ({
        ...prev,
        visible: true,
        coords: { left: coords.left, top: coords.top, bottom: coords.bottom },
        query: trigger.query,
        startPos: trigger.startPos,
      }));
      doSearch(trigger.query);
    } else {
      setAutocomplete((prev) => (prev.visible ? INITIAL_AUTOCOMPLETE : prev));
    }
  }, [doSearch]);

  const selectResultRef = useRef<(record: LinkableRecord) => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit,
      InlineLinkNode,
      // Inline font/size formatting. TextStyleWithFontSize must come before
      // FontFamily so FontFamily attaches its `fontFamily` attr to the
      // already-extended TextStyle mark. `types: ['textStyle']` tells
      // FontFamily where to write — same mark, different attr.
      TextStyleWithFontSize,
      FontFamily.configure({ types: ['textStyle'] }),
      ...(placeholder
        ? [Placeholder.configure({ placeholder })]
        : []),
    ],
    content: parseContent(content),
    editable,
    onUpdate: ({ editor }) => {
      debouncedUpdate(JSON.stringify(editor.getJSON()));
    },
    onBlur: () => {
      flushPending();
    },
    ...(autocompleteEnabled
      ? {
          editorProps: {
            handleKeyDown: (_view, event) => {
              const ac = acRef.current;
              if (!ac.visible) return false;
              if (event.key === 'Escape') {
                hideAutocomplete();
                return true;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setAutocomplete((prev) => ({
                  ...prev,
                  selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1),
                }));
                return true;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setAutocomplete((prev) => ({
                  ...prev,
                  selectedIndex: Math.max(prev.selectedIndex - 1, 0),
                }));
                return true;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                const selected = ac.results[ac.selectedIndex];
                if (selected) {
                  event.preventDefault();
                  selectResultRef.current(selected);
                  return true;
                }
              }
              return false;
            },
          },
        }
      : {}),
  });

  // Define selectResult after editor is available; expose via ref so the
  // editorProps.handleKeyDown closure can invoke the latest version.
  const selectResult = useCallback((record: LinkableRecord) => {
    if (!editor) return;
    const ac = acRef.current;
    insertInlineLink(editor.view, ac.startPos, {
      entityType: record.entity_type,
      entityId: record.id,
      label: record.name,
    });
    hideAutocomplete();
  }, [editor, hideAutocomplete]);
  selectResultRef.current = selectResult;

  // Subscribe to editor updates for bracket detection
  useEffect(() => {
    if (!editor || !autocompleteEnabled) return;
    const handler = () => checkForBracketTrigger(editor);
    editor.on('update', handler);
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('update', handler);
      editor.off('selectionUpdate', handler);
    };
  }, [editor, autocompleteEnabled, checkForBracketTrigger]);

  // Close autocomplete on outside click
  useEffect(() => {
    if (!autocomplete.visible) return;
    function handleClick(e: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        hideAutocomplete();
      }
    }
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [autocomplete.visible, hideAutocomplete]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync content from outside (e.g. switching characters)
  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(parsed);
    if (current !== incoming) {
      editor.commands.setContent(parsed);
    }
  }, [content, editor]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      flushPending();
    };
  }, [flushPending]);

  return (
    <div className={`tiptap-editor ${editable ? 'tiptap-editor--editable' : ''} ${className}`}>
      <EditorContent editor={editor} />
      {editable && <EditorBubbleMenu editor={editor} />}
      {/* Portal the autocomplete to document.body so it escapes any
       *  transformed ancestor (e.g. CharacterFlipContainer's rotateY), which
       *  would otherwise re-anchor position:fixed to the transform context
       *  and shift the dropdown far from the caret. */}
      {autocomplete.visible && autocomplete.results.length > 0 && createPortal(
        <div
          ref={autocompleteRef}
          className="tiptap-editor__autocomplete"
          style={{
            left: autocomplete.coords.left,
            top: autocomplete.coords.bottom + 4,
          }}
        >
          {autocomplete.results.map((record, idx) => (
            <button
              key={`${record.entity_type}-${record.id}`}
              type="button"
              className={`tiptap-editor__autocomplete-item ${
                idx === autocomplete.selectedIndex ? 'tiptap-editor__autocomplete-item--selected' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectResult(record);
              }}
              onMouseEnter={() =>
                setAutocomplete((prev) => ({ ...prev, selectedIndex: idx }))
              }
            >
              <span
                className="tiptap-editor__autocomplete-badge"
                data-type={record.entity_type}
              >
                {record.entity_type === 'character'
                  ? 'CHR'
                  : record.entity_type === 'map_entity'
                    ? 'LOC'
                    : 'DOC'}
              </span>
              <span className="tiptap-editor__autocomplete-name">{record.name}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function parseContent(content: string): Record<string, unknown> | string {
  if (!content || content === '{}') {
    return '';
  }
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
