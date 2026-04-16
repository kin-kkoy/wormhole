import { useState, useEffect } from 'react';
import './BriefDetailsEditor.css';

interface BriefDetail {
  key: string;
  value: string;
}

interface BriefDetailsEditorProps {
  details: BriefDetail[];
  editMode: boolean;
  onChange: (details: BriefDetail[]) => void;
}

export function BriefDetailsEditor({ details, editMode, onChange }: BriefDetailsEditorProps) {
  const [rows, setRows] = useState<BriefDetail[]>(details);

  useEffect(() => {
    setRows(details);
  }, [details]);

  function updateRow(index: number, field: 'key' | 'value', val: string) {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    setRows(updated);
  }

  function commitRows() {
    const cleaned = rows.filter((r) => r.key.trim() || r.value.trim());
    onChange(cleaned);
  }

  function addRow() {
    const updated = [...rows, { key: '', value: '' }];
    setRows(updated);
  }

  function removeRow(index: number) {
    const updated = rows.filter((_, i) => i !== index);
    setRows(updated);
    onChange(updated.filter((r) => r.key.trim() || r.value.trim()));
  }

  if (!editMode) {
    if (details.length === 0) return null;
    return (
      <div className="brief-details">
        {details.map((d, i) => (
          <div key={i} className="brief-details__row">
            <span className="brief-details__label">{d.key}</span>
            <span className="brief-details__value">{d.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="brief-details brief-details--editing">
      <label className="brief-details__heading">Brief Details</label>
      {rows.map((row, i) => (
        <div key={i} className="brief-details__edit-row">
          <input
            className="brief-details__input brief-details__input--key"
            value={row.key}
            onChange={(e) => updateRow(i, 'key', e.target.value)}
            onBlur={commitRows}
            placeholder="Label"
          />
          <input
            className="brief-details__input brief-details__input--value"
            value={row.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
            onBlur={commitRows}
            placeholder="Value"
          />
          <button className="brief-details__remove" onClick={() => removeRow(i)} title="Remove">
            &times;
          </button>
        </div>
      ))}
      <button className="brief-details__add" onClick={addRow}>
        + Add Detail
      </button>
    </div>
  );
}
