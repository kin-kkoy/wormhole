import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import './WorldFormDialog.css';

const WORLD_TYPES = ['Fantasy', 'Sci-Fi', 'Historical', 'Modern', 'Horror', 'Custom'];

export interface WorldFormValues {
  title: string;
  worldType: string;
  summary: string;
  coverFilePath: string | null;
  coverRemoved: boolean;
}

interface WorldFormDialogProps {
  mode: 'create' | 'edit';
  initialValues?: {
    title: string;
    worldType: string;
    summary: string;
    coverPreviewUrl: string | null;
  };
  onSubmit: (values: WorldFormValues) => void;
  onCancel: () => void;
}

export function WorldFormDialog({
  mode,
  initialValues,
  onSubmit,
  onCancel,
}: WorldFormDialogProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [worldType, setWorldType] = useState(initialValues?.worldType ?? 'Fantasy');
  const [summary, setSummary] = useState(initialValues?.summary ?? '');
  const [coverFilePath, setCoverFilePath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initialValues?.coverPreviewUrl ?? null
  );
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  async function handlePickCover() {
    try {
      const selected = await open({
        title: 'Choose cover image',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        ],
      });
      if (selected) {
        const path = selected as string;
        setCoverFilePath(path);
        setCoverRemoved(false);
        setCoverPreview(path);
      }
    } catch (e) {
      console.error('Failed to pick cover image:', e);
    }
  }

  function handleRemoveCover() {
    setCoverFilePath(null);
    setCoverPreview(null);
    setCoverRemoved(true);
  }

  function handleSubmit() {
    if (!title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    onSubmit({
      title: title.trim(),
      worldType,
      summary: summary.trim(),
      coverFilePath,
      coverRemoved,
    });
  }

  const isCreate = mode === 'create';

  return (
    <div className="dialog-overlay">
      <div className="dialog world-form-dialog">
        <h2 className="dialog__title">
          {isCreate ? 'Create World' : 'Edit World'}
        </h2>

        <div className="dialog__field">
          <label className="dialog__label">
            Title <span className="dialog__required">*</span>
          </label>
          <input
            ref={titleRef}
            className={`dialog__input ${titleError ? 'dialog__input--error' : ''}`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(false);
            }}
            placeholder="Enter world title..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
          {titleError && (
            <span className="dialog__error">Title is required</span>
          )}
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Genre / World Type</label>
          <select
            className="dialog__select"
            value={worldType}
            onChange={(e) => setWorldType(e.target.value)}
          >
            {WORLD_TYPES.map((wt) => (
              <option key={wt} value={wt}>{wt}</option>
            ))}
          </select>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Summary</label>
          <textarea
            className="dialog__textarea"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A brief description of your world..."
            rows={3}
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Cover Image</label>
          <div className="world-form-dialog__cover">
            {coverPreview ? (
              <div className="world-form-dialog__cover-preview">
                <div className="world-form-dialog__cover-thumb">
                  {coverPreview.startsWith('data:') ? (
                    <img src={coverPreview} alt="Cover preview" />
                  ) : (
                    <div className="world-form-dialog__cover-selected">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="7" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M5 14l3-3 2 2 4-4 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Image selected</span>
                    </div>
                  )}
                </div>
                <button
                  className="btn btn--ghost world-form-dialog__cover-remove"
                  onClick={handleRemoveCover}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                className="btn btn--secondary world-form-dialog__cover-pick"
                onClick={handlePickCover}
                type="button"
              >
                Choose Image...
              </button>
            )}
          </div>
        </div>

        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            {isCreate ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
