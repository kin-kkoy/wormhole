import { useState, useEffect, useRef } from 'react';
import { commands } from '../../lib/commands';
import './FolderDialog.css';

interface FolderDialogProps {
  mode: 'create' | 'rename';
  parentFolderId?: string;
  folderId?: string;
  currentTitle?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function FolderDialog({
  mode,
  parentFolderId,
  folderId,
  currentTitle,
  onClose,
  onComplete,
}: FolderDialogProps) {
  const [title, setTitle] = useState(currentTitle ?? '');
  const [titleError, setTitleError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    setErrorMessage(null);
    try {
      if (mode === 'create') {
        await commands.createLoreFolder({ title: trimmed, parentFolderId });
      } else if (folderId) {
        await commands.renameLoreFolder(folderId, trimmed);
      }
      onComplete();
    } catch (e) {
      const msg = String(e);
      setErrorMessage(
        msg.includes('nesting depth')
          ? 'Maximum folder depth reached (5 levels).'
          : `Failed: ${msg}`
      );
    }
    setSaving(false);
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog lore-folder-dialog">
        <h2 className="dialog__title">
          {mode === 'create' ? 'New Folder' : 'Rename Folder'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="dialog__field">
            <label className="dialog__label">
              Folder name <span className="dialog__required">*</span>
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
              placeholder="Enter folder name"
            />
          </div>
          {errorMessage && (
            <div className="dialog__error-banner">{errorMessage}</div>
          )}
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
