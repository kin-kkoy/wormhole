import { useState, useEffect, useRef, useCallback } from 'react';
import type { LinkableRecord } from '../../lib/commands';
import { commands } from '../../lib/commands';
import './LinkPickerDialog.css';

export type EntityType = 'character' | 'map_entity' | 'lore_document';

interface LinkPickerDialogProps {
  sourceType: EntityType;
  sourceId: string;
  /** Restrict picker to these target entity types. Omit to allow all. */
  allowedTargetTypes?: EntityType[];
  /** Keys of already-linked entities (`${entity_type}:${id}`). Rows matching
   *  these keys are shown with a muted "Already linked" badge. Selection is
   *  still allowed — the backend will reject the duplicate with an error. */
  existingLinkKeys?: Set<string>;
  /** Variant button styling for the primary "Link" action. */
  primaryVariant?: 'lore' | 'characters' | 'atlas' | 'default';
  onClose: () => void;
  onLinkCreated: () => void;
}

const SUGGESTED_LINK_TYPES = [
  'related_to',
  'ruler_of',
  'resident_in',
  'born_in',
  'active_in',
  'appears_in',
  'located_in',
  'tied_to_event',
  'reference',
];

const LINK_TYPE_PATTERN = /^[A-Za-z0-9_-]+$/;
const LINK_TYPE_MAX = 50;

function validateLinkType(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > LINK_TYPE_MAX) {
    return `Link type must be ${LINK_TYPE_MAX} characters or fewer`;
  }
  if (!LINK_TYPE_PATTERN.test(trimmed)) {
    return 'Use letters, numbers, underscore, or hyphen only';
  }
  return null;
}

const PRIMARY_VARIANT_CLASS: Record<NonNullable<LinkPickerDialogProps['primaryVariant']>, string> = {
  lore: 'btn--lore-primary',
  characters: 'btn--primary',
  atlas: 'btn--primary',
  default: 'btn--primary',
};

export function LinkPickerDialog({
  sourceType,
  sourceId,
  allowedTargetTypes,
  existingLinkKeys,
  primaryVariant = 'default',
  onClose,
  onLinkCreated,
}: LinkPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LinkableRecord[]>([]);
  const [selected, setSelected] = useState<LinkableRecord | null>(null);
  const [linkType, setLinkType] = useState('related_to');
  const [linkTypeError, setLinkTypeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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
          const filtered = allowedTargetTypes
            ? r.filter((rec) => allowedTargetTypes.includes(rec.entity_type as EntityType))
            : r;
          setResults(filtered);
        } catch (e) {
          console.error('Search failed:', e);
        }
      }, 200);
    },
    [sourceType, sourceId, allowedTargetTypes],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    doSearch(value);
  }

  function handleLinkTypeChange(value: string) {
    setLinkType(value);
    setLinkTypeError(validateLinkType(value));
  }

  async function handleLink() {
    if (!selected) return;
    const validationError = validateLinkType(linkType);
    if (validationError) {
      setLinkTypeError(validationError);
      return;
    }
    setSaving(true);
    setErrorMsg(null);
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
      setErrorMsg(String(e));
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
            results.map((record) => {
              const alreadyLinked = existingLinkKeys?.has(`${record.entity_type}:${record.id}`) ?? false;
              return (
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
                  {alreadyLinked && (
                    <span className="link-picker__result-existing">Already linked</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <div className="dialog__field">
            <label className="dialog__label">Link type</label>
            <input
              className="dialog__input"
              type="text"
              value={linkType}
              onChange={(e) => handleLinkTypeChange(e.target.value)}
              placeholder="related_to"
              list="link-type-suggestions"
              maxLength={LINK_TYPE_MAX}
            />
            <datalist id="link-type-suggestions">
              {SUGGESTED_LINK_TYPES.map((lt) => (
                <option key={lt} value={lt} />
              ))}
            </datalist>
            {linkTypeError && (
              <div className="link-picker__field-error">{linkTypeError}</div>
            )}
          </div>
        )}

        {errorMsg && <div className="link-picker__field-error">{errorMsg}</div>}

        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${PRIMARY_VARIANT_CLASS[primaryVariant]}`}
            disabled={!selected || saving || linkTypeError !== null}
            onClick={handleLink}
          >
            {saving ? 'Linking...' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
