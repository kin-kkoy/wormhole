import { useState, useEffect, useRef, useCallback } from 'react';
import type { LinkableRecord } from '../../lib/commands';
import { commands } from '../../lib/commands';
import './LinkPickerDialog.css';

interface LinkPickerDialogProps {
  sourceType: string;
  sourceId: string;
  onClose: () => void;
  onLinkCreated: () => void;
}

const SUGGESTED_LINK_TYPES = [
  'related_to',
  'appears_in',
  'mentioned_in',
  'ruler_of',
  'resident_in',
  'born_in',
  'active_in',
  'located_in',
  'tied_to_event',
];

export function LinkPickerDialog({
  sourceType,
  sourceId,
  onClose,
  onLinkCreated,
}: LinkPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LinkableRecord[]>([]);
  const [selected, setSelected] = useState<LinkableRecord | null>(null);
  const [linkType, setLinkType] = useState('related_to');
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchInputRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load initial results
  useEffect(() => {
    doSearch('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = useCallback(
    (q: string) => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const r = await commands.searchLinkableRecords({
            query: q,
            excludeType: sourceType,
            excludeId: sourceId,
          });
          setResults(r);
        } catch (e) {
          console.error('Search failed:', e);
        }
      }, 200);
    },
    [sourceType, sourceId],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    doSearch(value);
  }

  async function handleLink() {
    if (!selected) return;
    setSaving(true);
    try {
      await commands.createEntityLink({
        sourceType,
        sourceId,
        targetType: selected.entity_type,
        targetId: selected.id,
        linkType: linkType.trim() || 'related_to',
      });
      onLinkCreated();
    } catch (e) {
      console.error('Failed to create link:', e);
    }
    setSaving(false);
  }

  const badgeLabel = (type: string) =>
    type === 'character' ? 'CHR' : type === 'map_entity' ? 'LOC' : 'DOC';

  return (
    <div className="dialog-overlay">
      <div className="dialog link-picker-dialog">
        <h2 className="dialog__title">Link Record</h2>

        <div className="dialog__field">
          <label className="dialog__label">Search</label>
          <input
            ref={searchInputRef}
            className="dialog__input"
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search characters, locations, documents..."
          />
        </div>

        <div className="link-picker__results">
          {results.length === 0 ? (
            <div className="link-picker__results-empty">No results found</div>
          ) : (
            results.map((record) => (
              <button
                key={`${record.entity_type}-${record.id}`}
                className={`link-picker__result-item ${
                  selected?.id === record.id && selected?.entity_type === record.entity_type
                    ? 'link-picker__result-item--selected'
                    : ''
                }`}
                onClick={() => setSelected(record)}
              >
                <span className="link-picker__result-badge" data-type={record.entity_type}>
                  {badgeLabel(record.entity_type)}
                </span>
                <span className="link-picker__result-name">{record.name}</span>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="dialog__field">
            <label className="dialog__label">Link type</label>
            <input
              className="dialog__input"
              type="text"
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              placeholder="related_to"
              list="link-type-suggestions"
            />
            <datalist id="link-type-suggestions">
              {SUGGESTED_LINK_TYPES.map((lt) => (
                <option key={lt} value={lt} />
              ))}
            </datalist>
          </div>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--lore-primary"
            disabled={!selected || saving}
            onClick={handleLink}
          >
            {saving ? 'Linking...' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
