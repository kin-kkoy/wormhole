import { useEffect, useRef, useState } from 'react';
import './SharedNodeModal.css';

interface SharedNodeModalProps {
  onSubmit: (values: {
    name: string;
    fontStyle: string;
    fontSize: number;
    color: string;
  }) => void;
  onCancel: () => void;
}

const COLORS = [
  '#a78bfa', '#4a9eff', '#f5a623', '#4ade80', '#f472b6',
  '#fb923c', '#38bdf8', '#a3e635', '#e879f9', '#94a3b8',
];

export function SharedNodeModal({ onSubmit, onCancel }: SharedNodeModalProps) {
  const [name, setName] = useState('');
  const [fontStyle, setFontStyle] = useState('normal');
  const [fontSize, setFontSize] = useState(14);
  const [color, setColor] = useState(COLORS[0]);
  const [nameError, setNameError] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  function handleSubmit() {
    if (!name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    onSubmit({ name: name.trim(), fontStyle, fontSize, color });
  }

  return (
    <div className="shared-node-modal-overlay">
      <div className="shared-node-modal">
        <h3 className="shared-node-modal__title">Create Shared Node</h3>

        <div className="dialog__field">
          <label className="dialog__label">
            Name <span className="dialog__required">*</span>
          </label>
          <input
            ref={nameRef}
            className={`dialog__input ${nameError ? 'dialog__input--error' : ''}`}
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(false); }}
            placeholder="e.g., House Voss, Northern Alliance..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
          {nameError && <span className="dialog__error">Name is required</span>}
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Font Style</label>
          <select
            className="dialog__select"
            value={fontStyle}
            onChange={(e) => setFontStyle(e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
            <option value="bold">Bold</option>
          </select>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Font Size ({fontSize}px)</label>
          <input
            type="range"
            min={8}
            max={32}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="shared-node-modal__slider"
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Color</label>
          <div className="shared-node-modal__colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`shared-node-modal__color-swatch ${color === c ? 'shared-node-modal__color-swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={!name.trim()}>
            Create & Link
          </button>
        </div>
      </div>
    </div>
  );
}
