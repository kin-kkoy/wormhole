import { useEffect, useRef, useState } from 'react';
import { commands, type SearchResult, type SearchRecordType } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import './GlobalSearchBar.css';

interface GlobalSearchBarProps {
  onClose: () => void;
}

const TYPE_LABEL: Record<SearchRecordType, string> = {
  character: 'Character',
  map_entity: 'Map Entity',
  lore_document: 'Lore',
};

const TYPE_ACCENT: Record<SearchRecordType, string> = {
  character: 'var(--accent-characters)',
  map_entity: 'var(--accent-atlas)',
  lore_document: 'var(--accent-lore)',
};

export function GlobalSearchBar({ onClose }: GlobalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setPeekTarget = useAppStore((s) => s.setPeekTarget);

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      commands
        .searchWorld(trimmed)
        .then((r) => {
          setResults(r);
          setHighlight(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 150);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Escape to close + outside click
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    // Delay outside-click attach so the opening click doesn't immediately close
    const t = window.setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  function openResult(r: SearchResult) {
    setPeekTarget({ entityType: r.record_type, entityId: r.id });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[highlight];
      if (pick) openResult(pick);
    }
  }

  return (
    <div className="global-search" ref={containerRef}>
      <div className="global-search__field">
        <svg
          className="global-search__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="global-search__input"
          type="text"
          placeholder="Search characters, map entities, and lore documents"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="global-search__hint">Esc</span>
      </div>

      <div className="global-search__results">
        {!query.trim() && (
          <div className="global-search__empty">Start typing to search this world.</div>
        )}
        {query.trim() && loading && (
          <div className="global-search__empty">Searching...</div>
        )}
        {query.trim() && !loading && results.length === 0 && (
          <div className="global-search__empty">No matches found.</div>
        )}
        {results.map((r, i) => (
          <button
            key={`${r.record_type}-${r.id}`}
            className={`global-search__result ${i === highlight ? 'global-search__result--active' : ''}`}
            onMouseEnter={() => setHighlight(i)}
            onClick={() => openResult(r)}
          >
            <span
              className="global-search__chip"
              style={{ ['--chip-color' as string]: TYPE_ACCENT[r.record_type] }}
            >
              {TYPE_LABEL[r.record_type]}
            </span>
            <span className="global-search__result-body">
              <span className="global-search__title">{r.title}</span>
              {r.snippet && (
                <span className="global-search__snippet">{r.snippet}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
