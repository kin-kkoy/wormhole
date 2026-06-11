import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { LoreDocumentFull, LinkableRecord } from '../../lib/commands';
import { commands } from '../../lib/commands';
import {
  InlineLinkNode,
  detectBracketTrigger,
  insertInlineLink,
} from '../editor/InlineLinkExtension';
import {
  InlineLinkAutocomplete,
  buildAutocompleteItems,
  type AcItem,
} from '../editor/InlineLinkAutocomplete';
import { registerEditor, unregisterEditor } from '../linking/editorRegistry';
import { TextStyleWithFontSize } from '../editor/TextStyleWithFontSize';
import { EditorBubbleMenu } from '../editor/EditorBubbleMenu';
import { NextPagePicker } from './NextPagePicker';
import {
  DocFontControls,
  parseLoreOverrides,
  loreOverridesToStyle,
  type LoreOverrides,
} from './DocumentTypographyPanel';
import type { LoreTypographySettings } from '../../hooks/useLoreTypography';
import './DocumentEditor.css';

interface DocumentEditorProps {
  document: LoreDocumentFull;
  onDocumentUpdated: () => void;
  /** World-level lore typography defaults (for the per-doc override bar). */
  worldLoreSettings: LoreTypographySettings;
  /** Incremented whenever an external surface (LinkedRecordsPanel) mutates
   *  an entity link for this doc, so the NextPagePicker can re-read. */
  linkRefreshToken?: number;
  /** Focus mode (Proposal 02): toggle button state + handler. */
  focusMode?: boolean;
  onToggleFocus?: () => void;
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

export function DocumentEditor({
  document,
  onDocumentUpdated,
  worldLoreSettings,
  linkRefreshToken,
  focusMode = false,
  onToggleFocus,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(INITIAL_AUTOCOMPLETE);
  const [overrides, setOverrides] = useState<LoreOverrides>(() =>
    parseLoreOverrides(document.typography_overrides_json),
  );

  const docIdRef = useRef(document.id);
  const pendingContentRef = useRef<string | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref mirror so stale closures (editorProps.handleKeyDown) can read current values
  const acRef = useRef(autocomplete);
  acRef.current = autocomplete;

  const hideAutocomplete = useCallback(() => {
    setAutocomplete(INITIAL_AUTOCOMPLETE);
  }, []);

  const doSearch = useCallback((query: string, docId: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await commands.searchLinkableRecords({
          query,
          excludeType: 'lore_document',
          excludeId: docId,
        });
        setAutocomplete((prev) => (prev.visible ? { ...prev, results, selectedIndex: 0 } : prev));
      } catch (e) {
        console.error('Search failed:', e);
      }
    }, 150);
  }, []);

  // Helper: given editor state, check for [[ and update autocomplete
  const checkForBracketTrigger = useCallback((editorInstance: ReturnType<typeof useEditor>) => {
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
      doSearch(trigger.query, docIdRef.current);
    } else {
      // If we were showing autocomplete, hide it
      setAutocomplete((prev) => (prev.visible ? INITIAL_AUTOCOMPLETE : prev));
    }
  }, [doSearch]);

  const activateItem = useCallback(async (item: AcItem) => {
    if (!editor) return;
    const ac = acRef.current;

    if (item.kind === 'record') {
      insertInlineLink(editor.view, ac.startPos, {
        entityType: item.record.entity_type,
        entityId: item.record.id,
        label: item.record.name,
      });
      hideAutocomplete();
      return;
    }

    // Create-in-place: make a stub entity, then link to it. Capture the
    // trigger position before awaiting; verify it survived the round-trip.
    const name = ac.query.trim();
    if (!name) return;
    const startPos = ac.startPos;
    try {
      const created =
        item.entityType === 'lore_document'
          ? await (async () => {
              const doc = await commands.createLoreDocument({ title: name });
              return { entityType: 'lore_document' as const, entityId: doc.id, label: doc.title };
            })()
          : await (async () => {
              const ch = await commands.createCharacter({ name });
              return { entityType: 'character' as const, entityId: ch.id, label: ch.name };
            })();
      const trigger = detectBracketTrigger(editor.state.doc, editor.state.selection.from);
      if (!trigger || trigger.startPos !== startPos) return;
      insertInlineLink(editor.view, startPos, created);
      hideAutocomplete();
      // New root doc should show up in the folder tree immediately.
      if (created.entityType === 'lore_document') onDocumentUpdated();
    } catch (e) {
      console.error('Failed to create linked entity:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideAutocomplete, onDocumentUpdated]);

  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
  // Words on the page when this document was opened — the session delta is
  // measured against it. Null = capture on the next count.
  const sessionBaselineRef = useRef<number | null>(null);
  const [sessionDelta, setSessionDelta] = useState(0);
  // True while there are unsaved keystrokes (pending content not yet flushed).
  const [dirty, setDirty] = useState(false);

  const updateWordCount = useCallback((ed: { getText: () => string }) => {
    const text = ed.getText();
    const words = text.split(/\s+/).filter(Boolean).length;
    setWordCount({ words, chars: text.length });
    if (sessionBaselineRef.current === null) {
      sessionBaselineRef.current = words;
      setSessionDelta(0);
    } else {
      setSessionDelta(words - sessionBaselineRef.current);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      InlineLinkNode,
      TextStyleWithFontSize,
      FontFamily.configure({ types: ['textStyle'] }),
      // Underline + strike come from StarterKit; only TextAlign needs adding.
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: parseContent(document.content),
    editable: true,
    onCreate: ({ editor: ed }) => {
      updateWordCount(ed);
    },
    onUpdate: ({ editor: ed }) => {
      pendingContentRef.current = JSON.stringify(ed.getJSON());
      setDirty(true);
      updateWordCount(ed);
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        const ac = acRef.current;
        if (!ac.visible) return false;
        const items = buildAutocompleteItems(ac.results, ac.query);

        if (event.key === 'Escape') {
          hideAutocomplete();
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setAutocomplete((prev) => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, items.length - 1),
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
          const selected = items[ac.selectedIndex];
          if (selected) {
            event.preventDefault();
            activateItem(selected);
            return true;
          }
        }
        return false;
      },
    },
  });

  // Expose this editor to global UI (broken-link repair menu).
  useEffect(() => {
    if (!editor) return;
    registerEditor(editor);
    return () => unregisterEditor(editor);
  }, [editor]);

  // Check for [[ trigger on every editor update (selection or content change)
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => checkForBracketTrigger(editor);
    const handleSelectionUpdate = () => checkForBracketTrigger(editor);

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, checkForBracketTrigger]);

  // Sync content when switching documents
  useEffect(() => {
    if (!editor) return;
    if (document.id === docIdRef.current) return;

    // Flush any pending save for the previous document
    flushSave(docIdRef.current);

    docIdRef.current = document.id;
    setTitle(document.title);
    setOverrides(parseLoreOverrides(document.typography_overrides_json));
    pendingContentRef.current = null;
    hideAutocomplete();
    // New document → new writing session.
    sessionBaselineRef.current = null;

    const parsed = parseContent(document.content);
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(parsed);
    if (current !== incoming) {
      editor.commands.setContent(parsed);
    }
    // setContent fires onUpdate, which marks dirty and queues a pointless
    // save of the just-loaded content — clear both after the swap. Also
    // capture the baseline here in case setContent was skipped (identical
    // content) and onUpdate never ran.
    pendingContentRef.current = null;
    setDirty(false);
    updateWordCount(editor);
    setSaveStatus('idle');
  }, [document.id, document.content, editor, hideAutocomplete]);

  // Sync title when document prop changes
  useEffect(() => {
    setTitle(document.title);
  }, [document.title]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      flushSave(docIdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flushSave(targetDocId: string) {
    if (pendingContentRef.current !== null) {
      const content = pendingContentRef.current;
      pendingContentRef.current = null;
      commands
        .updateLoreDocument({ documentId: targetDocId, content })
        .then(() => setDirty(false))
        .catch((e) => console.error('Background save failed:', e));
    }
  }

  async function handleSave() {
    if (!editor) return;
    const json = JSON.stringify(editor.getJSON());
    setSaveStatus('saving');
    try {
      await commands.updateLoreDocument({ documentId: document.id, content: json });
      pendingContentRef.current = null;
      setDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (e) {
      console.error('Save failed:', e);
      setSaveStatus('idle');
    }
  }

  function handleEditorBlur() {
    if (pendingContentRef.current !== null) {
      handleSave();
    }
  }

  function persistOverrides(next: LoreOverrides) {
    setOverrides(next);
    const json = Object.keys(next).length ? JSON.stringify(next) : null;
    commands.updateDocumentTypography(document.id, json).catch(console.error);
  }
  function clearOverrides() {
    setOverrides({});
    commands.updateDocumentTypography(document.id, null).catch(console.error);
  }

  async function handleTitleBlur() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== document.title) {
      await commands.updateLoreDocument({ documentId: document.id, title: trimmed });
      onDocumentUpdated();
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  if (!editor) return null;

  return (
    <div className="doc-editor">
      <div className="doc-editor__header">
        <input
          className="doc-editor__title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="Document title"
        />
        <div className="doc-editor__toolbar">
          <button
            className={`doc-editor__tool-btn ${editor.isActive('heading', { level: 1 }) ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            H1
          </button>
          <button
            className={`doc-editor__tool-btn ${editor.isActive('heading', { level: 2 }) ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            H2
          </button>
          <button
            className={`doc-editor__tool-btn ${editor.isActive('heading', { level: 3 }) ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            H3
          </button>
          <span className="doc-editor__toolbar-sep" />
          <button
            className={`doc-editor__tool-btn ${editor.isActive('bold') ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            className={`doc-editor__tool-btn ${editor.isActive('italic') ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <em>I</em>
          </button>
          <span className="doc-editor__toolbar-sep" />
          <button
            className={`doc-editor__tool-btn ${editor.isActive('bulletList') ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M2 4a1 1 0 110-2 1 1 0 010 2zm3-1.5h9v1H5v-1zm-3 5a1 1 0 110-2 1 1 0 010 2zm3-1.5h9v1H5v-1zm-3 5a1 1 0 110-2 1 1 0 010 2zm3-1.5h9v1H5v-1z" />
            </svg>
          </button>
          <button
            className={`doc-editor__tool-btn ${editor.isActive('orderedList') ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M1.5 2h1v3h-1V3H1v-1h.5zm0 6h1.3L1.5 9.6v.4h2v-1H2.2l1.3-1.6V7h-2v1zM5 2.5h9v1H5v-1zm0 5h9v1H5v-1zm0 5h9v1H5v-1zM1.5 13v-1h2v.4l-.8.6h.8v1h-2v-.4l.8-.6h-.8z" />
            </svg>
          </button>
          <button
            className={`doc-editor__tool-btn ${editor.isActive('blockquote') ? 'doc-editor__tool-btn--active' : ''}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M2 3h5v5H4l-1 3H2V8l1-2H2V3zm7 0h5v5h-3l-1 3H9V8l1-2H9V3z" />
            </svg>
          </button>
          <button
            className="doc-editor__tool-btn"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M1 7.5h14v1H1z" />
            </svg>
          </button>
          <span className="doc-editor__toolbar-sep" />
          <button
            className="doc-editor__tool-btn"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M4.7 7H11a3 3 0 010 6H9v-1h2a2 2 0 000-4H4.7l2.15 2.15-.7.7L3 7.7l3.15-3.15.7.7L4.7 7z" />
            </svg>
          </button>
          <button
            className="doc-editor__tool-btn"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M11.3 7H5a3 3 0 000 6h2v-1H5a2 2 0 010-4h6.3l-2.15 2.15.7.7L13 7.7l-3.15-3.15-.7.7L11.3 7z" />
            </svg>
          </button>
          <span className="doc-editor__toolbar-sep" />
          <DocFontControls
            overrides={overrides}
            worldSettings={worldLoreSettings}
            onChange={persistOverrides}
            onClear={clearOverrides}
          />
          <span className="doc-editor__toolbar-sep" />
          <NextPagePicker
            documentId={document.id}
            onChanged={onDocumentUpdated}
            refreshToken={linkRefreshToken}
          />
          <div className="doc-editor__toolbar-right">
            {onToggleFocus && (
              <button
                type="button"
                className={`doc-editor__tool-btn doc-editor__focus-btn${
                  focusMode ? ' doc-editor__tool-btn--active' : ''
                }`}
                onClick={onToggleFocus}
                title={focusMode ? 'Exit focus mode (Esc)' : 'Focus mode (Ctrl+Shift+F)'}
                aria-pressed={focusMode}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
                </svg>
              </button>
            )}
            <button
              className="btn btn--lore-primary doc-editor__save-btn"
              onClick={handleSave}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div
        className="doc-editor__content doc-editor__doc"
        style={loreOverridesToStyle(overrides)}
        onBlur={handleEditorBlur}
      >
        <EditorContent editor={editor} />
      </div>
      <EditorBubbleMenu editor={editor} />

      <div className="doc-editor__footer">
        <span
          className="doc-editor__word-count"
          title={`${wordCount.chars.toLocaleString()} ${wordCount.chars === 1 ? 'character' : 'characters'}`}
        >
          {wordCount.words.toLocaleString()} {wordCount.words === 1 ? 'word' : 'words'}
          {wordCount.words > 0 && <> · ~{Math.max(1, Math.ceil(wordCount.words / 225))} min read</>}
        </span>
        {sessionDelta !== 0 && (
          <span
            className={`doc-editor__session-delta${
              sessionDelta < 0 ? ' doc-editor__session-delta--negative' : ''
            }`}
          >
            {sessionDelta > 0 ? `+${sessionDelta.toLocaleString()}` : sessionDelta.toLocaleString()} this session
          </span>
        )}
        <span
          className={`doc-editor__save-state${
            dirty || saveStatus === 'saving' ? ' doc-editor__save-state--editing' : ''
          }`}
        >
          {dirty ? 'Editing…' : saveStatus === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </div>

      {/* Autocomplete dropdown */}
      {autocomplete.visible && (
        <InlineLinkAutocomplete
          items={buildAutocompleteItems(autocomplete.results, autocomplete.query)}
          query={autocomplete.query}
          selectedIndex={autocomplete.selectedIndex}
          coords={autocomplete.coords}
          onSelect={activateItem}
          onHover={(idx) =>
            setAutocomplete((prev) => ({ ...prev, selectedIndex: idx }))
          }
          dropdownRef={autocompleteRef}
        />
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
