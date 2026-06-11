import { useCallback, useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import type { DeletedCharacter } from '../../lib/commands';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { relativeTime, absoluteTime, purgeCountdown } from '../../lib/recycleTime';
import './CharacterRecycleBin.css';

interface CharacterRecycleBinProps {
  onBack: () => void;
  /** Called after a restore or purge so the caller can refresh the main list. */
  onChanged: () => void;
}

export function CharacterRecycleBin({ onBack, onChanged }: CharacterRecycleBinProps) {
  const [items, setItems] = useState<DeletedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [purgeTarget, setPurgeTarget] = useState<DeletedCharacter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringAll, setRestoringAll] = useState(false);
  // Tick every minute so the purge countdown chips stay fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await commands.listDeletedCharacters();
      setItems(data);
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

  async function handleRestore(character: DeletedCharacter) {
    try {
      await commands.restoreCharacter(character.id);
      await refresh();
      onChanged();
    } catch (e) {
      console.error('Failed to restore character:', e);
      setError(String(e));
    }
  }

  async function handlePurge() {
    if (!purgeTarget) return;
    try {
      await commands.purgeCharacter(purgeTarget.id);
      setPurgeTarget(null);
      await refresh();
      onChanged();
    } catch (e) {
      console.error('Failed to purge character:', e);
      setError(String(e));
      setPurgeTarget(null);
    }
  }

  async function handleRestoreAll() {
    if (restoringAll || items.length === 0) return;
    setRestoringAll(true);
    try {
      // Sequential on purpose: avoids SQLite write contention and keeps
      // partial failures unambiguous (everything before the error restored).
      for (const item of items) {
        await commands.restoreCharacter(item.id);
      }
    } catch (e) {
      console.error('Failed to restore all characters:', e);
      setError(String(e));
    } finally {
      setRestoringAll(false);
      await refresh();
      onChanged();
    }
  }

  return (
    <div className="character-recycle-bin">
      <div className="character-recycle-bin__header">
        <button type="button" className="character-recycle-bin__back" onClick={onBack}>
          ← Back to characters
        </button>
        <span className="character-recycle-bin__title">Recycle Bin</span>
        <span className="character-recycle-bin__hint">
          Items purge 24 hours after deletion — cleanup runs on app launch.
        </span>
        {items.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost character-recycle-bin__restore-all"
            onClick={handleRestoreAll}
            disabled={restoringAll}
          >
            {restoringAll ? 'Restoring…' : 'Restore all'}
          </button>
        )}
      </div>

      {error && (
        <div className="character-recycle-bin__error">{error}</div>
      )}

      {loading ? (
        <div className="character-recycle-bin__loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="character-recycle-bin__empty">
          <span className="character-recycle-bin__empty-icon" aria-hidden="true">♳</span>
          <span className="character-recycle-bin__empty-title">Nothing here</span>
          <span className="character-recycle-bin__empty-sub">
            Deleted characters appear here for 24 hours before being permanently removed.
          </span>
        </div>
      ) : (
        <ul className="character-recycle-bin__list">
          {items.map((item) => (
            <li key={item.id} className="character-recycle-bin__row">
              <div className="character-recycle-bin__row-main">
                <span className="character-recycle-bin__row-name">{item.name}</span>
                <span className="character-recycle-bin__row-meta">
                  Deleted {relativeTime(item.deleted_at)} · {absoluteTime(item.deleted_at)}
                </span>
              </div>
              {(() => {
                const cd = purgeCountdown(item.deleted_at, now);
                return (
                  <span className={`recycle-chip recycle-chip--${cd.state}`}>{cd.label}</span>
                );
              })()}
              <div className="character-recycle-bin__row-actions">
                <button
                  type="button"
                  className="btn btn--primary character-recycle-bin__restore"
                  onClick={() => handleRestore(item)}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="btn btn--ghost character-recycle-bin__purge"
                  onClick={() => setPurgeTarget(item)}
                >
                  Delete permanently
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {purgeTarget && (
        <ConfirmDialog
          title="Delete Permanently"
          message={`Permanently delete "${purgeTarget.name}"? This cannot be undone — any links pointing to this character will become broken.`}
          confirmLabel="Delete Permanently"
          confirmDanger
          onConfirm={handlePurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}
    </div>
  );
}
