import { useCallback, useMemo } from 'react';
import type { DetailSection } from '../../../lib/commands';
import './KeyValueSection.css';

interface KeyValueRow {
  id: string;
  label: string;
  value: string;
}

interface KeyValueSectionProps {
  section: DetailSection;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: { structuredContentJson?: string }) => void;
}

export function KeyValueSection({ section, editMode, onUpdate }: KeyValueSectionProps) {
  const rows: KeyValueRow[] = useMemo(() => {
    if (!section.structured_content_json) return [];
    try {
      return JSON.parse(section.structured_content_json);
    } catch {
      return [];
    }
  }, [section.structured_content_json]);

  const saveRows = useCallback((updated: KeyValueRow[]) => {
    onUpdate(section.id, { structuredContentJson: JSON.stringify(updated) });
  }, [section.id, onUpdate]);

  const updateRow = useCallback((rowId: string, field: 'label' | 'value', val: string) => {
    const updated = rows.map((r) => r.id === rowId ? { ...r, [field]: val } : r);
    saveRows(updated);
  }, [rows, saveRows]);

  const addRow = useCallback(() => {
    const newRow: KeyValueRow = {
      id: crypto.randomUUID(),
      label: '',
      value: '',
    };
    saveRows([...rows, newRow]);
  }, [rows, saveRows]);

  const removeRow = useCallback((rowId: string) => {
    saveRows(rows.filter((r) => r.id !== rowId));
  }, [rows, saveRows]);

  if (!editMode && rows.length === 0) {
    return <div className="kv-section__empty">No entries yet.</div>;
  }

  return (
    <div className="kv-section">
      <div className="kv-section__grid">
        {rows.map((row) => (
          <div key={row.id} className="kv-section__row">
            {editMode ? (
              <>
                <input
                  className="kv-section__input kv-section__input--label"
                  value={row.label}
                  onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                  placeholder="Label"
                />
                <input
                  className="kv-section__input kv-section__input--value"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                  placeholder="Value"
                />
                <button className="kv-section__remove" onClick={() => removeRow(row.id)} title="Remove">
                  &times;
                </button>
              </>
            ) : (
              <>
                <span className="kv-section__label">{row.label}</span>
                <span className="kv-section__value">{row.value}</span>
              </>
            )}
          </div>
        ))}
      </div>
      {editMode && (
        <button className="kv-section__add" onClick={addRow}>
          + Add Row
        </button>
      )}
    </div>
  );
}
