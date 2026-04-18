import { useCallback, useEffect, useState } from 'react';
import {
  commands,
  type DeletedCharacter,
  type DeletedMapEntity,
  type DeletedLoreDocument,
  type DeletedLoreFolder,
} from '../../lib/commands';
import { ConfirmDialog } from './ConfirmDialog';
import './RecycleBinDialog.css';

interface RecycleBinDialogProps {
  onClose: () => void;
}

type RowKind = 'character' | 'map_entity' | 'lore_document' | 'lore_folder';

interface PurgeTarget {
  kind: RowKind | 'all';
  id?: string;
  label: string;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function RecycleBinDialog({ onClose }: RecycleBinDialogProps) {
  const [characters, setCharacters] = useState<DeletedCharacter[]>([]);
  const [mapEntities, setMapEntities] = useState<DeletedMapEntity[]>([]);
  const [documents, setDocuments] = useState<DeletedLoreDocument[]>([]);
  const [folders, setFolders] = useState<DeletedLoreFolder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [c, m, d, f] = await Promise.all([
        commands.listDeletedCharacters(),
        commands.listDeletedMapEntities(),
        commands.listDeletedLoreDocuments(),
        commands.listDeletedLoreFolders(),
      ]);
      setCharacters(c);
      setMapEntities(m);
      setDocuments(d);
      setFolders(f);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Only close the bin on Escape if no nested confirm dialog is open.
      if (e.key === 'Escape' && !purgeTarget) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, purgeTarget]);

  const total = characters.length + mapEntities.length + documents.length + folders.length;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    const target = purgeTarget;
    setPurgeTarget(null);
    await run(async () => {
      if (target.kind === 'all') {
        await Promise.all([
          ...characters.map((x) => commands.purgeCharacter(x.id)),
          ...mapEntities.map((x) => commands.purgeMapEntity(x.id)),
          ...documents.map((x) => commands.purgeLoreDocument(x.id)),
          ...folders.map((x) => commands.purgeLoreFolder(x.id)),
        ]);
      } else if (target.id) {
        if (target.kind === 'character') await commands.purgeCharacter(target.id);
        else if (target.kind === 'map_entity') await commands.purgeMapEntity(target.id);
        else if (target.kind === 'lore_document') await commands.purgeLoreDocument(target.id);
        else if (target.kind === 'lore_folder') await commands.purgeLoreFolder(target.id);
      }
    });
  }

  return (
    <>
      <div className="dialog-overlay">
        <div className="dialog recycle-bin">
          <h2 className="dialog__title">Recycle Bin</h2>
          <p className="recycle-bin__info">
            Items are permanently deleted after 24 hours.
          </p>
          {error && <p className="recycle-bin__error">{error}</p>}

          {total === 0 ? (
            <div className="recycle-bin__empty">Recycle bin is empty.</div>
          ) : (
            <div className="recycle-bin__sections">
              <Section
                title="Characters"
                count={characters.length}
                accent="var(--accent-characters)"
              >
                {characters.map((c) => (
                  <Row
                    key={c.id}
                    title={c.name}
                    deletedAt={c.deleted_at}
                    disabled={busy}
                    onRestore={() => run(() => commands.restoreCharacter(c.id))}
                    onPurge={() => setPurgeTarget({ kind: 'character', id: c.id, label: c.name })}
                  />
                ))}
              </Section>

              <Section
                title="Map Entities"
                count={mapEntities.length}
                accent="var(--accent-atlas)"
              >
                {mapEntities.map((e) => (
                  <Row
                    key={e.id}
                    title={e.title}
                    deletedAt={e.deleted_at}
                    disabled={busy}
                    onRestore={() => run(() => commands.restoreMapEntity(e.id))}
                    onPurge={() => setPurgeTarget({ kind: 'map_entity', id: e.id, label: e.title })}
                  />
                ))}
              </Section>

              <Section
                title="Lore Documents"
                count={documents.length}
                accent="var(--accent-lore)"
              >
                {documents.map((d) => (
                  <Row
                    key={d.id}
                    title={d.title}
                    deletedAt={d.deleted_at}
                    disabled={busy}
                    onRestore={() => run(() => commands.restoreLoreDocument(d.id))}
                    onPurge={() => setPurgeTarget({ kind: 'lore_document', id: d.id, label: d.title })}
                  />
                ))}
              </Section>

              <Section
                title="Lore Folders"
                count={folders.length}
                accent="var(--accent-lore)"
              >
                {folders.map((f) => (
                  <Row
                    key={f.id}
                    title={f.title}
                    deletedAt={f.deleted_at}
                    disabled={busy}
                    onRestore={() => run(() => commands.restoreLoreFolder(f.id))}
                    onPurge={() => setPurgeTarget({ kind: 'lore_folder', id: f.id, label: f.title })}
                  />
                ))}
              </Section>
            </div>
          )}

          <div className="dialog__actions recycle-bin__actions">
            <button
              className="btn btn--danger"
              disabled={busy || total === 0}
              onClick={() =>
                setPurgeTarget({ kind: 'all', label: `${total} item${total === 1 ? '' : 's'}` })
              }
            >
              Empty Recycle Bin
            </button>
            <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Close
            </button>
          </div>
        </div>
      </div>

      {purgeTarget && (
        <ConfirmDialog
          title={purgeTarget.kind === 'all' ? 'Empty Recycle Bin?' : 'Permanently delete?'}
          message={
            purgeTarget.kind === 'all'
              ? `Permanently delete ${purgeTarget.label}? This cannot be undone.`
              : `Permanently delete “${purgeTarget.label}”? This cannot be undone.`
          }
          confirmLabel={purgeTarget.kind === 'all' ? 'Empty Bin' : 'Delete Forever'}
          confirmDanger
          onConfirm={confirmPurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}
    </>
  );
}

interface SectionProps {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}

function Section({ title, count, accent, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div className="recycle-bin__section">
      <button
        className="recycle-bin__section-header"
        onClick={() => setOpen((o) => !o)}
        style={{ ['--section-accent' as string]: accent }}
      >
        <span className="recycle-bin__section-caret">{open ? '▾' : '▸'}</span>
        <span className="recycle-bin__section-title">{title}</span>
        <span className="recycle-bin__section-count">{count}</span>
      </button>
      {open && <div className="recycle-bin__section-body">{children}</div>}
    </div>
  );
}

interface RowProps {
  title: string;
  deletedAt: string;
  disabled: boolean;
  onRestore: () => void;
  onPurge: () => void;
}

function Row({ title, deletedAt, disabled, onRestore, onPurge }: RowProps) {
  return (
    <div className="recycle-bin__row">
      <div className="recycle-bin__row-body">
        <span className="recycle-bin__row-title">{title || 'Untitled'}</span>
        <span className="recycle-bin__row-time">Deleted {formatRelative(deletedAt)}</span>
      </div>
      <div className="recycle-bin__row-actions">
        <button
          className="btn btn--ghost recycle-bin__row-btn"
          onClick={onRestore}
          disabled={disabled}
        >
          Restore
        </button>
        <button
          className="btn btn--danger recycle-bin__row-btn"
          onClick={onPurge}
          disabled={disabled}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
