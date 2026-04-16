import { useState, useEffect, useRef } from 'react';
import { commands } from '../../lib/commands';
import './DocumentDialog.css';

interface DocumentDialogProps {
  mode: 'create' | 'rename';
  folderId?: string;
  documentId?: string;
  currentTitle?: string;
  onClose: () => void;
  onComplete: (docId?: string) => void;
}

export function DocumentDialog({
  mode,
  folderId,
  documentId,
  currentTitle,
  onClose,
  onComplete,
}: DocumentDialogProps) {
  const [title, setTitle] = useState(currentTitle ?? '');
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError(true);
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const doc = await commands.createLoreDocument({ title: trimmed, folderId });
        onComplete(doc.id);
      } else if (documentId) {
        await commands.updateLoreDocument({ documentId, title: trimmed });
        onComplete();
      }
    } catch (e) {
      console.error('Document operation failed:', e);
    }
    setSaving(false);
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog lore-document-dialog">
        <h2 className="dialog__title">
          {mode === 'create' ? 'New Document' : 'Rename Document'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="dialog__field">
            <label className="dialog__label">
              Document title <span className="dialog__required">*</span>
            </label>
            <input
              ref={inputRef}
              className={`dialog__input ${titleError ? 'dialog__input--error' : ''}`}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleError(false);
              }}
              placeholder="Enter document title"
            />
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--lore-primary"
              disabled={saving}
            >
              {mode === 'create' ? 'Create' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
