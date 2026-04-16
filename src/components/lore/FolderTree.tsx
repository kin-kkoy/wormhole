import { useState, useCallback, useRef } from 'react';
import type { LoreFolder, LoreDocumentSummary } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { ContextMenu } from '../common/ContextMenu';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FolderDialog } from './FolderDialog';
import { DocumentDialog } from './DocumentDialog';
import './FolderTree.css';

interface FolderTreeProps {
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  selectedDocumentId: string | null;
  onSelectDocument: (docId: string | null) => void;
  onRefresh: () => void;
}

interface TreeFolder extends LoreFolder {
  children: TreeFolder[];
  docs: LoreDocumentSummary[];
  depth: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'root' | 'folder' | 'document';
  id?: string;
  parentFolderId?: string | null;
}

interface FolderDialogState {
  mode: 'create' | 'rename';
  parentFolderId?: string;
  folderId?: string;
  currentTitle?: string;
}

interface DocumentDialogState {
  mode: 'create' | 'rename';
  folderId?: string;
  documentId?: string;
  currentTitle?: string;
}

interface DeleteTarget {
  type: 'folder' | 'document';
  id: string;
  title: string;
  docCount?: number;
}

interface DragState {
  type: 'folder' | 'document';
  id: string;
}

// Drop zone: 'before' = insert above, 'into' = reparent into folder, 'after' = insert below
type DropZone = 'before' | 'into' | 'after';

interface DragOverState {
  targetId: string;
  zone: DropZone;
}

function buildTree(
  folders: LoreFolder[],
  documents: LoreDocumentSummary[],
): { roots: TreeFolder[]; rootDocs: LoreDocumentSummary[]; folderMap: Map<string, TreeFolder> } {
  const folderMap = new Map<string, TreeFolder>();

  for (const f of folders) {
    folderMap.set(f.id, { ...f, children: [], docs: [], depth: 0 });
  }

  const roots: TreeFolder[] = [];

  for (const tf of folderMap.values()) {
    if (tf.parent_folder_id && folderMap.has(tf.parent_folder_id)) {
      folderMap.get(tf.parent_folder_id)!.children.push(tf);
    } else {
      roots.push(tf);
    }
  }

  function sortChildren(folder: TreeFolder, depth: number) {
    folder.depth = depth;
    folder.children.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    for (const child of folder.children) {
      sortChildren(child, depth + 1);
    }
  }
  roots.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  for (const r of roots) {
    sortChildren(r, 0);
  }

  const rootDocs: LoreDocumentSummary[] = [];
  for (const doc of documents) {
    if (doc.folder_id && folderMap.has(doc.folder_id)) {
      folderMap.get(doc.folder_id)!.docs.push(doc);
    } else {
      rootDocs.push(doc);
    }
  }

  for (const tf of folderMap.values()) {
    tf.docs.sort((a, b) => a.title.localeCompare(b.title));
  }
  rootDocs.sort((a, b) => a.title.localeCompare(b.title));

  return { roots, rootDocs, folderMap };
}

function isDescendantOf(
  folderMap: Map<string, TreeFolder>,
  folderId: string,
  potentialAncestorId: string,
): boolean {
  if (folderId === potentialAncestorId) return true;
  const folder = folderMap.get(folderId);
  if (!folder || !folder.parent_folder_id) return false;
  return isDescendantOf(folderMap, folder.parent_folder_id, potentialAncestorId);
}

/** Determine drop zone from mouse Y position relative to element */
function getDropZone(e: React.DragEvent, isFolder: boolean): DropZone {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (isFolder) {
    // Folders: top 25% = before, middle 50% = into, bottom 25% = after
    if (y < height * 0.25) return 'before';
    if (y > height * 0.75) return 'after';
    return 'into';
  }
  // Documents: top 50% = before, bottom 50% = after (can't drop "into" a doc)
  return y < height * 0.5 ? 'before' : 'after';
}

export function FolderTree({
  folders,
  documents,
  selectedDocumentId,
  onSelectDocument,
  onRefresh,
}: FolderTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null);
  const [documentDialog, setDocumentDialog] = useState<DocumentDialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<DragOverState | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const { roots, rootDocs, folderMap } = buildTree(folders, documents);

  const toggleExpanded = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  function handleContextMenu(e: React.MouseEvent, state: ContextMenuState) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ ...state, x: e.clientX, y: e.clientY });
  }

  function getContextMenuItems(): { label: string; onClick: () => void }[] {
    if (!contextMenu) return [];

    if (contextMenu.type === 'root') {
      return [
        { label: 'New Folder', onClick: () => setFolderDialog({ mode: 'create' }) },
        { label: 'New Document', onClick: () => setDocumentDialog({ mode: 'create' }) },
      ];
    }

    if (contextMenu.type === 'folder') {
      return [
        {
          label: 'New Document Here',
          onClick: () => setDocumentDialog({ mode: 'create', folderId: contextMenu.id }),
        },
        {
          label: 'New Subfolder',
          onClick: () => setFolderDialog({ mode: 'create', parentFolderId: contextMenu.id }),
        },
        {
          label: 'Rename',
          onClick: () => {
            const folder = folders.find((f) => f.id === contextMenu.id);
            if (folder) {
              setFolderDialog({ mode: 'rename', folderId: folder.id, currentTitle: folder.title });
            }
          },
        },
        {
          label: 'Delete',
          onClick: async () => {
            const folder = folders.find((f) => f.id === contextMenu.id);
            if (!folder) return;
            const count = await commands.getFolderDocCount(folder.id);
            setDeleteTarget({ type: 'folder', id: folder.id, title: folder.title, docCount: count });
          },
        },
      ];
    }

    // document
    return [
      {
        label: 'Rename',
        onClick: () => {
          const doc = documents.find((d) => d.id === contextMenu.id);
          if (doc) {
            setDocumentDialog({ mode: 'rename', documentId: doc.id, currentTitle: doc.title });
          }
        },
      },
      {
        label: 'Delete',
        onClick: () => {
          const doc = documents.find((d) => d.id === contextMenu.id);
          if (doc) {
            setDeleteTarget({ type: 'document', id: doc.id, title: doc.title });
          }
        },
      },
    ];
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'folder') {
        await commands.deleteLoreFolder(deleteTarget.id);
      } else {
        await commands.deleteLoreDocument(deleteTarget.id);
        if (selectedDocumentId === deleteTarget.id) {
          onSelectDocument(null);
        }
      }
      onRefresh();
    } catch (e) {
      console.error('Delete failed:', e);
    }
    setDeleteTarget(null);
  }

  // ─── Drag and drop ────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, type: 'folder' | 'document', id: string) {
    setDragState({ type, id });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleFolderDragOver(e: React.DragEvent, folderId: string) {
    if (!dragState) return;
    // Block dropping folder into itself or descendant
    if (dragState.type === 'folder' && isDescendantOf(folderMap, folderId, dragState.id)) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const zone = getDropZone(e, true);
    setDragOver({ targetId: folderId, zone });
  }

  function handleDocDragOver(e: React.DragEvent, docId: string) {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const zone = getDropZone(e, false);
    setDragOver({ targetId: docId, zone });
  }

  function handleRootDragOver(e: React.DragEvent) {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ targetId: '__root__', zone: 'into' });
  }

  async function handleFolderDrop(e: React.DragEvent, targetFolder: TreeFolder) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragState) return;

    const zone = getDropZone(e, true);

    try {
      if (zone === 'into') {
        // Reparent: move dragged item INTO this folder
        if (dragState.type === 'folder') {
          if (isDescendantOf(folderMap, targetFolder.id, dragState.id)) return;
          // Compute sort_order: place at end of children
          const siblingCount = targetFolder.children.length;
          await commands.moveLoreFolder({
            folderId: dragState.id,
            newParentFolderId: targetFolder.id,
            sortOrder: siblingCount,
          });
        } else {
          await commands.moveLoreDocument(dragState.id, targetFolder.id);
        }
        // Auto-expand the target folder so the user sees the result
        setExpandedIds((prev) => new Set(prev).add(targetFolder.id));
      } else {
        // Reorder: place before/after this folder among its siblings
        if (dragState.type === 'folder') {
          if (isDescendantOf(folderMap, targetFolder.id, dragState.id)) return;

          const parentId = targetFolder.parent_folder_id;
          // Get siblings in current order
          const siblings = parentId
            ? (folderMap.get(parentId)?.children ?? [])
            : roots;

          // Build new order: remove dragged folder, insert at target position
          const newOrder = siblings.filter((f) => f.id !== dragState.id).map((f) => f.id);
          const targetIdx = newOrder.indexOf(targetFolder.id);
          const insertIdx = zone === 'before' ? targetIdx : targetIdx + 1;
          newOrder.splice(insertIdx, 0, dragState.id);

          // First move to correct parent if different
          const draggedFolder = folderMap.get(dragState.id);
          if (draggedFolder && draggedFolder.parent_folder_id !== parentId) {
            await commands.moveLoreFolder({
              folderId: dragState.id,
              newParentFolderId: parentId ?? undefined,
              sortOrder: insertIdx,
            });
          }

          // Then reorder all siblings
          await commands.reorderLoreFolders(newOrder);
        } else {
          // Document dropped before/after a folder — move to same parent as folder
          await commands.moveLoreDocument(dragState.id, targetFolder.parent_folder_id);
        }
      }
      onRefresh();
    } catch (e) {
      console.error('Drop failed:', e);
    }

    setDragState(null);
    setDragOver(null);
  }

  async function handleDocDrop(e: React.DragEvent, targetDoc: LoreDocumentSummary) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragState) return;

    try {
      if (dragState.type === 'folder') {
        // Move folder to same parent as the document's folder
        const parentId = targetDoc.folder_id;
        await commands.moveLoreFolder({
          folderId: dragState.id,
          newParentFolderId: parentId ?? undefined,
          sortOrder: 999,
        });
      } else {
        // Move document to same folder as target document
        await commands.moveLoreDocument(dragState.id, targetDoc.folder_id);
      }
      onRefresh();
    } catch (e) {
      console.error('Drop failed:', e);
    }

    setDragState(null);
    setDragOver(null);
  }

  async function handleRootDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!dragState) return;

    try {
      if (dragState.type === 'folder') {
        await commands.moveLoreFolder({
          folderId: dragState.id,
          sortOrder: roots.length,
        });
      } else {
        await commands.moveLoreDocument(dragState.id, null);
      }
      onRefresh();
    } catch (e) {
      console.error('Drop failed:', e);
    }

    setDragState(null);
    setDragOver(null);
  }

  function handleDragEnd() {
    setDragState(null);
    setDragOver(null);
  }

  function getDragOverClass(itemId: string): string {
    if (!dragOver || dragOver.targetId !== itemId) return '';
    if (dragOver.zone === 'into') return 'folder-tree__item--drag-into';
    if (dragOver.zone === 'before') return 'folder-tree__item--drag-before';
    return 'folder-tree__item--drag-after';
  }

  // ─── Render ───────────────────────────────────────────────────────

  function renderDocument(doc: LoreDocumentSummary, depth: number) {
    const isSelected = selectedDocumentId === doc.id;

    return (
      <div
        key={doc.id}
        className={`folder-tree__item folder-tree__item--doc ${isSelected ? 'folder-tree__item--selected' : ''} ${getDragOverClass(doc.id)}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelectDocument(doc.id)}
        onContextMenu={(e) =>
          handleContextMenu(e, { type: 'document', id: doc.id, x: 0, y: 0 })
        }
        draggable
        onDragStart={(e) => handleDragStart(e, 'document', doc.id)}
        onDragOver={(e) => handleDocDragOver(e, doc.id)}
        onDrop={(e) => handleDocDrop(e, doc)}
        onDragEnd={handleDragEnd}
      >
        <svg className="folder-tree__icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm1 3v1h6V4H5zm0 3v1h6V7H5zm0 3v1h4v-1H5z" />
        </svg>
        <span className="folder-tree__label" title={doc.title}>
          {doc.title}
        </span>
      </div>
    );
  }

  function renderFolder(folder: TreeFolder) {
    const isExpanded = expandedIds.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className={`folder-tree__item folder-tree__item--folder ${getDragOverClass(folder.id)}`}
          style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
          onClick={() => toggleExpanded(folder.id)}
          onContextMenu={(e) =>
            handleContextMenu(e, {
              type: 'folder',
              id: folder.id,
              parentFolderId: folder.parent_folder_id,
              x: 0,
              y: 0,
            })
          }
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
          onDragOver={(e) => handleFolderDragOver(e, folder.id)}
          onDrop={(e) => handleFolderDrop(e, folder)}
          onDragEnd={handleDragEnd}
        >
          <svg
            className={`folder-tree__chevron ${isExpanded ? 'folder-tree__chevron--expanded' : ''}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg className="folder-tree__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44L8.56 3.56A.5.5 0 008.854 3.5H13.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
          </svg>
          <span className="folder-tree__label" title={folder.title}>
            {folder.title}
          </span>
          {folder.docs.length + folder.children.length > 0 && (
            <span className="folder-tree__count">
              {folder.docs.length + folder.children.length}
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="folder-tree__children">
            {folder.children.map((child) => renderFolder(child))}
            {folder.docs.map((doc) => renderDocument(doc, folder.depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="folder-tree" ref={treeRef}>
      <div className="folder-tree__header">
        <span className="folder-tree__title">Lore Archive</span>
        <button
          className="folder-tree__add-btn"
          title="New Document"
          onClick={() => setDocumentDialog({ mode: 'create' })}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z" />
          </svg>
        </button>
      </div>

      <div
        className={`folder-tree__content ${dragOver?.targetId === '__root__' ? 'folder-tree__content--drag-over' : ''}`}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            handleContextMenu(e, { type: 'root', x: 0, y: 0 });
          }
        }}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        {roots.map((folder) => renderFolder(folder))}
        {rootDocs.map((doc) => renderDocument(doc, 0))}
        {roots.length === 0 && rootDocs.length === 0 && (
          <div className="folder-tree__empty">
            <span>No folders or documents</span>
            <span>Right-click to create</span>
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {folderDialog && (
        <FolderDialog
          mode={folderDialog.mode}
          parentFolderId={folderDialog.parentFolderId}
          folderId={folderDialog.folderId}
          currentTitle={folderDialog.currentTitle}
          onClose={() => setFolderDialog(null)}
          onComplete={() => {
            setFolderDialog(null);
            onRefresh();
          }}
        />
      )}

      {documentDialog && (
        <DocumentDialog
          mode={documentDialog.mode}
          folderId={documentDialog.folderId}
          documentId={documentDialog.documentId}
          currentTitle={documentDialog.currentTitle}
          onClose={() => setDocumentDialog(null)}
          onComplete={(docId) => {
            setDocumentDialog(null);
            onRefresh();
            if (docId) {
              onSelectDocument(docId);
            }
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type === 'folder' ? 'Folder' : 'Document'}`}
          message={
            deleteTarget.type === 'folder'
              ? `Delete "${deleteTarget.title}"? ${
                  deleteTarget.docCount
                    ? `${deleteTarget.docCount} document${deleteTarget.docCount !== 1 ? 's' : ''} will be moved to root.`
                    : 'This folder is empty.'
                }`
              : `Delete "${deleteTarget.title}"? It will be moved to the recycle bin.`
          }
          confirmLabel="Delete"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
