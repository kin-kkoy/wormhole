import { useEffect, useState, useCallback, useRef } from 'react';
import { commands } from '../../lib/commands';
import type { LoreFolder, LoreDocumentSummary, LoreDocumentFull, NextPageLink } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { FolderTree } from '../../components/lore/FolderTree';
import { DocumentEditor } from '../../components/lore/DocumentEditor';
import { LinkedRecordsPanel } from '../../components/lore/LinkedRecordsPanel';
import { ModeToggle } from '../../components/lore/read/ModeToggle';
import { ReadModeShell } from './read/ReadModeShell';
import { LoreRecycleBin } from './LoreRecycleBin';
import { LoreTypographySettings } from './LoreTypographySettings';
import { useLoreTypography } from '../../hooks/useLoreTypography';
import { LOOSE_BOOK_ID, STACK_SEGMENT } from '../../state/store';
import './LoreArchive.css';
import './read/ReadMode.css';

export function LoreArchive() {
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  const setSelectedDocumentId = useAppStore((s) => s.setSelectedDocumentId);
  const loreMode = useAppStore((s) => s.loreMode);
  const setLoreMode = useAppStore((s) => s.setLoreMode);
  const activeFolderPath = useAppStore((s) => s.activeFolderPath);
  const setActiveFolderPath = useAppStore((s) => s.setActiveFolderPath);
  const popFolderPathTo = useAppStore((s) => s.popFolderPathTo);
  const activeWorld = useAppStore((s) => s.activeWorld);
  const loreTypography = useLoreTypography(activeWorld?.id ?? null);
  const [showTypography, setShowTypography] = useState(false);

  const [folders, setFolders] = useState<LoreFolder[]>([]);
  const [documents, setDocuments] = useState<LoreDocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<LoreDocumentFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [nextPageMap, setNextPageMap] = useState<Map<string, string>>(new Map());
  const [focusMode, setFocusMode] = useState(false);
  // Bumped whenever a mutation happens that peer panels need to react to
  // (e.g. NextPagePicker changing a link → LinkedRecordsPanel should reload).
  const [linkRefreshToken, setLinkRefreshToken] = useState(0);

  // Track previous doc ID to flush saves on switch (Write mode only).
  const prevDocIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [f, d, np] = await Promise.all([
        commands.listLoreFolders(),
        commands.listLoreDocuments(),
        commands.listNextPageLinks(),
      ]);
      setFolders(f);
      setDocuments(d);
      const m = new Map<string, string>();
      for (const link of np as NextPageLink[]) m.set(link.source_id, link.target_id);
      setNextPageMap(m);
    } catch (e) {
      console.error('Failed to load lore data:', e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // Load active document for Write mode's DocumentEditor. Read Mode has its
  // own fetch in BookReader so this effect only fires when mode === 'edit'.
  useEffect(() => {
    if (loreMode !== 'edit') {
      setActiveDocument(null);
      prevDocIdRef.current = null;
      return;
    }
    if (!selectedDocumentId) {
      setActiveDocument(null);
      prevDocIdRef.current = null;
      return;
    }

    prevDocIdRef.current = selectedDocumentId;

    (async () => {
      try {
        const doc = await commands.getLoreDocument(selectedDocumentId);
        setActiveDocument(doc);
      } catch (e) {
        console.error('Failed to load document:', e);
        setActiveDocument(null);
      }
    })();
  }, [selectedDocumentId, loreMode]);

  function handleSelectDocument(docId: string | null) {
    setSelectedDocumentId(docId);
  }

  function handleDocumentUpdated() {
    if (selectedDocumentId) {
      commands.getLoreDocument(selectedDocumentId).then(setActiveDocument).catch(console.error);
    }
    refresh();
    setLinkRefreshToken((n) => n + 1);
  }

  const isRead = loreMode === 'read';

  // Focus mode (Proposal 02): hide tree + links panes, center the editor.
  // Local state — LoreArchive stays mounted across tab switches (TabPane).
  // NOTE: hooks must stay ABOVE the early returns below, or the hook count
  // changes between renders and React tears the whole tab down.
  useEffect(() => {
    if (isRead) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode((f) => !f);
      } else if (e.key === 'Escape' && !e.defaultPrevented) {
        // Escape's first job is closing whatever is on top. Dialogs register
        // their own window listeners AFTER this one (they mount later), so
        // defaultPrevented can't protect us — check the DOM instead.
        if (document.querySelector('.dialog-overlay')) return;
        setFocusMode(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRead]);

  // Focus mode is meaningless without a document — and leaving it on while
  // the empty state shows just dims an already-sparse screen.
  useEffect(() => {
    if (!activeDocument) setFocusMode(false);
  }, [activeDocument]);

  // Immersion flag on <body>: lets focus mode quiet chrome that lives
  // outside this component (the TopDock). Always cleaned up on unmount.
  const immersive = focusMode && !isRead;
  useEffect(() => {
    document.body.classList.toggle('lore-focus-immersive', immersive);
    return () => document.body.classList.remove('lore-focus-immersive');
  }, [immersive]);

  if (loading) {
    return (
      <div className="lore-archive__empty">
        <span style={{ fontSize: '14px' }}>Loading...</span>
      </div>
    );
  }

  if (showRecycleBin) {
    return (
      <div className="lore-archive-wrapper">
        <LoreRecycleBin
          onBack={() => setShowRecycleBin(false)}
          onChanged={() => {
            refresh();
            setLinkRefreshToken((n) => n + 1);
          }}
        />
      </div>
    );
  }

  // Breadcrumb in Read Mode: full drill-down path. Clickable segments pop
  // the path back to that depth. Rendered only when there's somewhere to
  // navigate back to (path depth > 0). In Write mode the row is empty.
  const showBreadcrumb = isRead && activeFolderPath.length > 0;

  return (
    <div
      className={
        'lore-archive-wrapper' +
        (isRead ? ' lore-read-mode' : '') +
        (immersive ? ' lore-archive-wrapper--focus' : '')
      }
    >
      <div className="lore-archive__header">
        <div className="lore-archive__breadcrumb">
          {showBreadcrumb ? (
            <>
              <button
                type="button"
                className="lore-archive__breadcrumb-back"
                onClick={() => {
                  setActiveFolderPath([]);
                  setSelectedDocumentId(null);
                }}
                title="Back to library"
              >
                &larr; Library
              </button>
              {activeFolderPath.map((segment, i) => (
                <Segment
                  key={`${segment}-${i}`}
                  segment={segment}
                  folders={folders}
                  isLast={i === activeFolderPath.length - 1}
                  onClick={() => {
                    popFolderPathTo(i + 1);
                    setSelectedDocumentId(null);
                  }}
                />
              ))}
            </>
          ) : (
            <span />
          )}
        </div>
        <div className="lore-archive__header-controls">
          <button
            type="button"
            className="lore-archive__icon-btn"
            onClick={() => setShowTypography(true)}
            title="Typography"
            aria-label="Lore typography settings"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 13 L 6.5 3 L 9.5 3 L 13 13 M 5 9.5 L 11 9.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="lore-archive__icon-btn"
            onClick={() => setShowRecycleBin(true)}
            title="Recycle Bin"
            aria-label="Lore Recycle Bin"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 5h10M6.5 5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V5M4.5 5l.6 7.4a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9L11.5 5M7 7.5v4M9 7.5v4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <ModeToggle mode={loreMode} onChange={setLoreMode} />
        </div>
      </div>

      {isRead ? (
        <ReadModeShell
          folders={folders}
          documents={documents}
          nextPageMap={nextPageMap}
          onSwitchToWrite={() => setLoreMode('edit')}
          onNextPageLinksChanged={refresh}
        />
      ) : (
        <EditLayout
          folders={folders}
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          activeDocument={activeDocument}
          worldLoreSettings={loreTypography.settings}
          onSelectDocument={handleSelectDocument}
          onRefresh={refresh}
          onDocumentUpdated={handleDocumentUpdated}
          onLinkMutated={() => {
            refresh();
            setLinkRefreshToken((n) => n + 1);
          }}
          linkRefreshToken={linkRefreshToken}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((f) => !f)}
        />
      )}

      {showTypography && (
        <LoreTypographySettings
          settings={loreTypography.settings}
          onChange={loreTypography.update}
          onReset={loreTypography.reset}
          onClose={() => setShowTypography(false)}
        />
      )}
    </div>
  );
}

function Segment({
  segment,
  folders,
  isLast,
  onClick,
}: {
  segment: string;
  folders: LoreFolder[];
  isLast: boolean;
  onClick: () => void;
}) {
  const label = resolveSegmentLabel(segment, folders);
  return (
    <>
      <span className="lore-archive__breadcrumb-sep" aria-hidden="true">/</span>
      {isLast ? (
        <span className="lore-archive__breadcrumb-current">{label}</span>
      ) : (
        <button
          type="button"
          className="lore-archive__breadcrumb-back"
          onClick={onClick}
          title={`Back to ${label}`}
        >
          {label}
        </button>
      )}
    </>
  );
}

function resolveSegmentLabel(segment: string, folders: LoreFolder[]): string {
  if (segment === LOOSE_BOOK_ID) return 'Loose Pages';
  if (segment === STACK_SEGMENT) return 'Pages';
  return folders.find((f) => f.id === segment)?.title ?? 'Untitled';
}

interface EditLayoutProps {
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  selectedDocumentId: string | null;
  activeDocument: LoreDocumentFull | null;
  worldLoreSettings: import('../../hooks/useLoreTypography').LoreTypographySettings;
  onSelectDocument: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  onDocumentUpdated: () => void;
  onLinkMutated: () => void;
  linkRefreshToken: number;
  focusMode: boolean;
  onToggleFocus: () => void;
}

function EditLayout({
  folders,
  documents,
  selectedDocumentId,
  activeDocument,
  worldLoreSettings,
  onSelectDocument,
  onRefresh,
  onDocumentUpdated,
  onLinkMutated,
  linkRefreshToken,
  focusMode,
  onToggleFocus,
}: EditLayoutProps) {
  return (
    <div className={'lore-archive' + (focusMode ? ' lore-archive--focus' : '')}>
      <div className="lore-archive__folder-panel">
        <FolderTree
          folders={folders}
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={onSelectDocument}
          onRefresh={onRefresh}
        />
      </div>

      <div className="lore-archive__content-panel">
        <div className="lore-archive__editor-pane">
          {activeDocument ? (
            <DocumentEditor
              document={activeDocument}
              onDocumentUpdated={onDocumentUpdated}
              worldLoreSettings={worldLoreSettings}
              linkRefreshToken={linkRefreshToken}
              focusMode={focusMode}
              onToggleFocus={onToggleFocus}
            />
          ) : (
            <div className="lore-archive__empty">
              <span style={{ fontSize: '32px', opacity: 0.3 }}>&#9998;</span>
              <span style={{ fontSize: '14px', color: 'var(--accent-lore)' }}>
                Select or create a document
              </span>
              <span style={{ fontSize: '12px' }}>
                Right-click the folder tree to get started
              </span>
            </div>
          )}
        </div>

        {activeDocument && (
          <div className="lore-archive__links-pane">
            <LinkedRecordsPanel
              documentId={activeDocument.id}
              onRefresh={onLinkMutated}
              refreshToken={linkRefreshToken}
            />
          </div>
        )}
      </div>
    </div>
  );
}
