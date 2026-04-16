import { useState, useEffect } from 'react';
import './RibbonColorPicker.css';

const SWATCHES = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#a855f6', '#ec4899',
];

interface RibbonColorPickerProps {
  color: string | null;
  onChange: (color: string | null) => void;
}

export function RibbonColorPicker({ color, onChange }: RibbonColorPickerProps) {
  const [hexInput, setHexInput] = useState(color || '');

  useEffect(() => {
    setHexInput(color || '');
  }, [color]);

  function handleHexSubmit() {
    const hex = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(hex);
    }
  }

  return (
    <div className="ribbon-picker">
      <label className="ribbon-picker__label">Ribbon Color</label>
      <div className="ribbon-picker__swatches">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            className={`ribbon-picker__swatch ${color === swatch ? 'ribbon-picker__swatch--active' : ''}`}
            style={{ backgroundColor: swatch }}
            onClick={() => onChange(swatch)}
            title={swatch}
          />
        ))}
      </div>
      <div className="ribbon-picker__hex-row">
        <input
          className="ribbon-picker__hex-input"
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
          placeholder="#RRGGBB"
          maxLength={7}
        />
        {color && (
          <button className="ribbon-picker__clear" onClick={() => { onChange(null); setHexInput(''); }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
