import './SearchOverlay.css';

interface SearchOverlayProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
}

export function SearchOverlay({ query, onQueryChange, placeholder }: SearchOverlayProps) {
  return (
    <div className="graph-search">
      <svg className="graph-search__icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <input
        className="graph-search__input"
        type="text"
        placeholder={placeholder ?? 'Search...'}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {query && (
        <button
          className="graph-search__clear"
          onClick={() => onQueryChange('')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}
