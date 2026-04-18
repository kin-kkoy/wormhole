import { useState, useRef, useEffect } from 'react';
import './SectionCreateDialog.css';

interface LayoutType {
  value: string;
  label: string;
  description: string;
}

const LAYOUT_TYPES: LayoutType[] = [
  { value: 'prose', label: 'Prose', description: 'Longform rich text content, ideal for narrative passages and paragraphs.' },
  { value: 'cards', label: 'Cards', description: 'A 3-column grid of compact cards, each with a title, subtitle, and description.' },
  { value: 'timeline', label: 'Timeline', description: 'A vertical chronological list with dates, titles, and short descriptions.' },
  { value: 'grid', label: 'Key-Value', description: 'Label and value pairs arranged in a responsive grid — great for factual data.' },
];

function LayoutPreview({ type }: { type: string }) {
  switch (type) {
    case 'prose':
      return (
        <div className="layout-preview layout-preview--prose" aria-hidden="true">
          <span className="layout-preview-prose__line" style={{ width: '90%' }} />
          <span className="layout-preview-prose__line" style={{ width: '100%' }} />
          <span className="layout-preview-prose__line" style={{ width: '85%' }} />
          <span className="layout-preview-prose__line" style={{ width: '70%' }} />
        </div>
      );
    case 'cards':
      return (
        <div className="layout-preview layout-preview--cards" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="layout-preview-cards__card" />
          ))}
        </div>
      );
    case 'timeline':
      return (
        <div className="layout-preview layout-preview--timeline" aria-hidden="true">
          <span className="layout-preview-timeline__spine" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="layout-preview-timeline__row">
              <span className="layout-preview-timeline__dot" />
              <div className="layout-preview-timeline__content">
                <span className="layout-preview-timeline__title" />
                <span className="layout-preview-timeline__desc" />
              </div>
            </div>
          ))}
        </div>
      );
    case 'grid':
      return (
        <div className="layout-preview layout-preview--grid" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="layout-preview-grid__row">
              <span className="layout-preview-grid__label" />
              <span className="layout-preview-grid__value" />
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

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
            <div className="layout-type-picker">
              {LAYOUT_TYPES.map((lt) => {
                const isSelected = layoutType === lt.value;
                return (
                  <button
                    key={lt.value}
                    type="button"
                    className={`layout-type-tile ${isSelected ? 'layout-type-tile--selected' : ''}`}
                    onClick={() => setLayoutType(lt.value)}
                    aria-pressed={isSelected}
                    title={lt.label}
                  >
                    <div className="layout-type-tile__preview-wrap">
                      <LayoutPreview type={lt.value} />
                    </div>
                    <div className="layout-type-tile__info">
                      <span className="layout-type-tile__label">{lt.label}</span>
                      <span className="layout-type-tile__desc">{lt.description}</span>
                    </div>
                    {isSelected && (
                      <span className="layout-type-tile__check" aria-hidden="true">&#10003;</span>
                    )}
                  </button>
                );
              })}
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
