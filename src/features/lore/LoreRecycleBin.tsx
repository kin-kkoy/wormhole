import { useCallback, useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import type { DeletedLoreDocument, DeletedLoreFolder } from '../../lib/commands';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { relativeTime, absoluteTime, purgeCountdown } from '../../lib/recycleTime';
import './LoreRecycleBin.css';

interface LoreRecycleBinProps {
  onBack: () => void;
  /** Called after a restore or purge so the lore archive can refresh
   *  whatever listing it's currently showing. */
  onChanged: () => void;
}

type PurgeTarget =
  | { kind: 'document'; item: DeletedLoreDocument }
  | { kind: 'folder'; item: DeletedLoreFolder }
  | null;

export function LoreRecycleBin({ onBack, onChanged }: LoreRecycleBinProps) {
  const [docs, setDocs] = useState<DeletedLoreDocument[]>([]);
  const [folders, setFolders] = useState<DeletedLoreFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringSection, setRestoringSection] = useState<'docs' | 'folders' | null>(null);
  // Tick every minute so the purge countdown chips stay fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [d, f] = await Promise.all([
        commands.listDeletedLoreDocuments(),
        commands.listDeletedLoreFolders(),
      ]);
      setDocs(d);
      setFolders(f);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRestoreDoc(doc: DeletedLoreDocument) {
    try {
      await commands.restoreLoreDocument(doc.id);
      await refresh();
      onChanged();
    } catch (e) {
      console.error('Failed to restore lore document:', e);
      setError(String(e));
    }
  }

  async function handleRestoreFolder(folder: DeletedLoreFolder) {
    try {
      await commands.restoreLoreFolder(folder.id);
      await refresh();
      onChanged();
    } catch (e) {
      console.error('Failed to restore lore folder:', e);
      setError(String(e));
    }
  }

  async function handlePurge() {
    if (!purgeTarget) return;
    try {
      if (purgeTarget.kind === 'document') {
        await commands.purgeLoreDocument(purgeTarget.item.id);
      } else {
        await commands.purgeLoreFolder(purgeTarget.item.id);
      }
      setPurgeTarget(null);
      await refresh();
      onChanged();
    } catch (e) {
      console.error('Failed to purge lore item:', e);
      setError(String(e));
      setPurgeTarget(null);
    }
  }

  async function handleRestoreAll(kind: 'docs' | 'folders') {
    if (restoringSection) return;
    setRestoringSection(kind);
    try {
      // Sequential on purpose: avoids SQLite write contention and keeps
      // partial failures unambiguous (everything before the error restored).
      if (kind === 'docs') {
        for (const doc of docs) await commands.restoreLoreDocument(doc.id);
      } else {
        for (const folder of folders) await commands.restoreLoreFolder(folder.id);
      }
    } catch (e) {
      console.error('Failed to restore all lore items:', e);
      setError(String(e));
    } finally {
      setRestoringSection(null);
      await refresh();
      onChanged();
    }
  }

  const isEmpty = docs.length === 0 && folders.length === 0;

  return (
    <div className="lore-recycle-bin">
      <div className="lore-recycle-bin__header">
        <button type="button" className="lore-recycle-bin__back" onClick={onBack}>
          ← Back to lore
        </button>
        <span className="lore-recycle-bin__title">Lore Recycle Bin</span>
        <span className="lore-recycle-bin__hint">
          Items purge 24 hours after deletion — cleanup runs on app launch.
        </span>
      </div>

      {error && <div className="lore-recycle-bin__error">{error}</div>}

      {loading ? (
        <div className="lore-recycle-bin__loading">Loading…</div>
      ) : isEmpty ? (
        <div className="lore-recycle-bin__empty">
          <span className="lore-recycle-bin__empty-icon" aria-hidden="true">♳</span>
          <span className="lore-recycle-bin__empty-title">Nothing here</span>
          <span className="lore-recycle-bin__empty-sub">
            Soft-deleted lore documents and folders appear here for 24 hours before
            being permanently removed.
          </span>
        </div>
      ) : (
        <div className="lore-recycle-bin__sections">
          {docs.length > 0 && (
            <section className="lore-recycle-bin__section">
              <h3 className="lore-recycle-bin__section-title">
                Documents
                <button
                  type="button"
                  className="btn btn--ghost lore-recycle-bin__restore-all"
                  onClick={() => handleRestoreAll('docs')}
                  disabled={restoringSection !== null}
                >
                  {restoringSection === 'docs' ? 'Restoring…' : 'Restore all'}
                </button>
              </h3>
              <ul className="lore-recycle-bin__list">
                {docs.map((doc) => (
                  <li key={doc.id} className="lore-recycle-bin__row">
                    <div className="lore-recycle-bin__row-main">
                      <span className="lore-recycle-bin__row-name">{doc.title}</span>
                      <span className="lore-recycle-bin__row-meta">
                        Deleted {relativeTime(doc.deleted_at)} · {absoluteTime(doc.deleted_at)}
                      </span>
                    </div>
                    {(() => {
                      const cd = purgeCountdown(doc.deleted_at, now);
                      return (
                        <span className={`recycle-chip recycle-chip--${cd.state}`}>{cd.label}</span>
                      );
                    })()}
                    <div className="lore-recycle-bin__row-actions">
                      <button
                        type="button"
                        className="btn btn--primary lore-recycle-bin__restore"
                        onClick={() => handleRestoreDoc(doc)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost lore-recycle-bin__purge"
                        onClick={() => setPurgeTarget({ kind: 'document', item: doc })}
                      >
                        Delete permanently
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {folders.length > 0 && (
            <section className="lore-recycle-bin__section">
              <h3 className="lore-recycle-bin__section-title">
                Folders
                <button
                  type="button"
                  className="btn btn--ghost lore-recycle-bin__restore-all"
                  onClick={() => handleRestoreAll('folders')}
                  disabled={restoringSection !== null}
                >
                  {restoringSection === 'folders' ? 'Restoring…' : 'Restore all'}
                </button>
              </h3>
              <ul className="lore-recycle-bin__list">
                {folders.map((folder) => (
                  <li key={folder.id} className="lore-recycle-bin__row">
                    <div className="lore-recycle-bin__row-main">
                      <span className="lore-recycle-bin__row-name">{folder.title}</span>
                      <span className="lore-recycle-bin__row-meta">
                        Deleted {relativeTime(folder.deleted_at)} · {absoluteTime(folder.deleted_at)}
                      </span>
                    </div>
                    {(() => {
                      const cd = purgeCountdown(folder.deleted_at, now);
                      return (
                        <span className={`recycle-chip recycle-chip--${cd.state}`}>{cd.label}</span>
                      );
                    })()}
                    <div className="lore-recycle-bin__row-actions">
                      <button
                        type="button"
                        className="btn btn--primary lore-recycle-bin__restore"
                        onClick={() => handleRestoreFolder(folder)}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost lore-recycle-bin__purge"
                        onClick={() => setPurgeTarget({ kind: 'folder', item: folder })}
                      >
                        Delete permanently
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {purgeTarget && (
        <ConfirmDialog
          title="Delete Permanently"
          message={
            purgeTarget.kind === 'document'
              ? `Permanently delete "${purgeTarget.item.title}"? This cannot be undone — any links pointing to this document will become broken.`
              : `Permanently delete "${purgeTarget.item.title}"? This cannot be undone. All documents inside this folder were already moved with it when it was deleted.`
          }
          confirmLabel="Delete Permanently"
          confirmDanger
          onConfirm={handlePurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}
    </div>
  );
}
