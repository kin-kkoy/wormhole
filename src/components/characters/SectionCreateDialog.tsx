import { useState, useRef, useEffect } from 'react';
import './SectionCreateDialog.css';

const LAYOUT_TYPES = [
  { value: 'prose', label: 'Prose', description: 'Longform rich text content' },
  { value: 'cards', label: 'Cards', description: '3-column grid of small cards' },
  { value: 'timeline', label: 'Timeline', description: 'Vertical list of chronological entries' },
  { value: 'grid', label: 'Key-Value', description: 'Label and value pairs in a grid' },
];

interface SectionCreateDialogProps {
  onClose: () => void;
  onCreate: (title: string, layoutType: string) => void;
}

export function SectionCreateDialog({ onClose, onCreate }: SectionCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [layoutType, setLayoutType] = useState('prose');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), layoutType);
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="dialog section-create-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Add Section</h2>
        <form onSubmit={handleSubmit}>
          <div className="dialog__field">
            <label className="dialog__label">Section Title *</label>
            <input
              ref={titleRef}
              className="dialog__input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Background, Relationships, Opinions"
            />
          </div>

          <div className="dialog__field">
            <label className="dialog__label">Layout Type</label>
            <div className="section-create-dialog__types">
              {LAYOUT_TYPES.map((lt) => (
                <button
                  key={lt.value}
                  type="button"
                  className={`section-create-dialog__type ${layoutType === lt.value ? 'section-create-dialog__type--active' : ''}`}
                  onClick={() => setLayoutType(lt.value)}
                >
                  <span className="section-create-dialog__type-label">{lt.label}</span>
                  <span className="section-create-dialog__type-desc">{lt.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!title.trim()}
              style={{ background: 'var(--accent-characters)' }}
            >
              Add Section
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
