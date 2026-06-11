import { useEffect, useRef, useState } from 'react';
import type { CharacterSummary } from '../../lib/commands';
import { useImageCache } from '../../hooks/useImageCache';
import './ShelfCreateDialog.css';

interface ShelfCreateDialogProps {
  characters: CharacterSummary[];
  onSubmit: (name: string, characterIds: string[]) => void;
  onCancel: () => void;
}

export function ShelfCreateDialog({
  characters,
  onSubmit,
  onCancel,
}: ShelfCreateDialogProps) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const { getImageUrl } = useImageCache();

  useEffect(() => {
    inputRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, Array.from(selected));
  }

  return (
    <div className="dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog shelf-create-dialog">
        <h2 className="dialog__title">Create Shelf</h2>

        <div className="dialog__field">
          <label className="dialog__label">
            Shelf Name <span className="dialog__required">*</span>
          </label>
          <input
            ref={inputRef}
            className="dialog__input"
            type="text"
            placeholder="e.g. House Caden, The Veilwardens…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>

        {characters.length > 0 && (
          <div className="dialog__field">
            <label className="dialog__label">
              Add Characters ({selected.size} selected)
            </label>
            <div className="shelf-create-dialog__roster">
              {characters.map((c) => {
                const url = c.image_asset_id ? getImageUrl(c.image_asset_id) : null;
                const active = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    className={`shelf-create-dialog__char ${active ? 'shelf-create-dialog__char--active' : ''}`}
                    onClick={() => toggle(c.id)}
                    type="button"
                  >
                    <div className="shelf-create-dialog__char-avatar">
                      {url ? (
                        <img src={url} alt="" draggable={false} />
                      ) : (
                        <span className="shelf-create-dialog__char-initial">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="shelf-create-dialog__char-name">{c.name}</span>
                    {active && (
                      <svg className="shelf-create-dialog__check" width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create Shelf
          </button>
        </div>
      </div>
    </div>
  );
}
