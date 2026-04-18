import { useEffect, useState, useCallback, useRef } from 'react';
import { commands } from '../../lib/commands';
import type { LoreFolder, LoreDocumentSummary, LoreDocumentFull } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { FolderTree } from '../../components/lore/FolderTree';
import { DocumentEditor } from '../../components/lore/DocumentEditor';
import { LinkedRecordsPanel } from '../../components/lore/LinkedRecordsPanel';
import './LoreArchive.css';

export function LoreArchive() {
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  const setSelectedDocumentId = useAppStore((s) => s.setSelectedDocumentId);

  const [folders, setFolders] = useState<LoreFolder[]>([]);
  const [documents, setDocuments] = useState<LoreDocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<LoreDocumentFull | null>(null);
  const [loading, setLoading] = useState(true);

  // Track previous doc ID to flush saves on switch
  const prevDocIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([
        commands.listLoreFolders(),
        commands.listLoreDocuments(),
      ]);
      setFolders(f);
      setDocuments(d);
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

  // Load active document when selection changes
  useEffect(() => {
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
  }, [selectedDocumentId]);

  function handleSelectDocument(docId: string | null) {
    setSelectedDocumentId(docId);
  }

  function handleDocumentUpdated() {
    // Re-fetch the active document to get fresh data (title changes, etc.)
    if (selectedDocumentId) {
      commands.getLoreDocument(selectedDocumentId).then(setActiveDocument).catch(console.error);
    }
    // Also refresh the tree to update titles
    refresh();
  }

  if (loading) {
    return (
      <div className="lore-archive__empty">
        <span style={{ fontSize: '14px' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div className="lore-archive">
      <div className="lore-archive__folder-panel">
        <FolderTree
          folders={folders}
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={handleSelectDocument}
          onRefresh={refresh}
        />
      </div>

      {/* Contents panel — groups editor + linked records in one detached
          rounded container, with an internal divider between the two. */}
      <div className="lore-archive__content-panel">
        <div className="lore-archive__editor-pane">
          {activeDocument ? (
            <DocumentEditor
              document={activeDocument}
              onDocumentUpdated={handleDocumentUpdated}
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
              onRefresh={refresh}
            />
          </div>
        )}
      </div>
    </div>
  );
}
