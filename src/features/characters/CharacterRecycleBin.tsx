import { useCallback, useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import type { DeletedCharacter } from '../../lib/commands';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import './CharacterRecycleBin.css';

interface CharacterRecycleBinProps {
  onBack: () => void;
  /** Called after a restore or purge so the caller can refresh the main list. */
  onChanged: () => void;
}

const RTF = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
  ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  : null;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = then - Date.now();
  const absSec = Math.abs(diffMs) / 1000;
  if (!RTF) return new Date(iso).toLocaleString();
  if (absSec < 60) return RTF.format(Math.round(diffMs / 1000), 'second');
  if (absSec < 3600) return RTF.format(Math.round(diffMs / 60000), 'minute');
  if (absSec < 86400) return RTF.format(Math.round(diffMs / 3600000), 'hour');
  return RTF.format(Math.round(diffMs / 86400000), 'day');
}

export function CharacterRecycleBin({ onBack, onChanged }: CharacterRecycleBinProps) {
  const [items, setItems] = useState<DeletedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [purgeTarget, setPurgeTarget] = useState<DeletedCharacter | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="character-recycle-bin">
      <div className="character-recycle-bin__header">
        <button type="button" className="character-recycle-bin__back" onClick={onBack}>
          ← Back to characters
        </button>
        <span className="character-recycle-bin__title">Recycle Bin</span>
        <span className="character-recycle-bin__hint">
          Auto-purges after 24 hours.
        </span>
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
                <span
                  className="character-recycle-bin__row-meta"
                  title={new Date(item.deleted_at).toLocaleString()}
                >
                  Deleted {relativeTime(item.deleted_at)}
                </span>
              </div>
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
