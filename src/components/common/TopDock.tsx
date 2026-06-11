import { useEffect, useState } from 'react';
import { useAppStore, type TabId } from '../../state/store';
import { GlobalSearchBar } from './GlobalSearchBar';
import './TopDock.css';

// The Atlas Canvas tab stays visible but renders an "In Development"
// placeholder — the system is detached for redesign.
const TABS: { id: TabId; label: string; accent: string }[] = [
  { id: 'overview', label: 'Overview', accent: 'var(--accent-overview)' },
  { id: 'atlas', label: 'Atlas Canvas', accent: 'var(--accent-atlas)' },
  { id: 'characters', label: 'Character Codex', accent: 'var(--accent-characters)' },
  { id: 'lore', label: 'Lore Archive', accent: 'var(--accent-lore)' },
];

interface TopDockProps {
  onBack: () => void;
}

export function TopDock({ onBack }: TopDockProps) {
  const activeTab = useAppStore((s) => s.activeTab);
  const activeWorld = useAppStore((s) => s.activeWorld);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchAllowed = activeTab !== 'atlas';

  // Close the overlay if the user switches to a tab that shouldn't host it.
  useEffect(() => {
    if (!searchAllowed && searchOpen) setSearchOpen(false);
  }, [searchAllowed, searchOpen]);

  // Cmd/Ctrl+K opens search — but only on tabs where search is allowed.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!searchAllowed) return;
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [searchAllowed]);

  return (
    <>
      <header className="top-dock">
        <div className="top-dock__cluster">
          <button className="top-dock__back" onClick={onBack} title="Back to World Index">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {activeWorld && (
            <div className="top-dock__world" title={activeWorld.title}>
              <span className="top-dock__world-sigil" aria-hidden="true">✦</span>
              {activeWorld.title}
            </div>
          )}

          <div className="top-dock__divider" aria-hidden="true" />

          <nav className="top-dock__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`top-dock__tab ${activeTab === tab.id ? 'top-dock__tab--active' : ''}`}
                style={activeTab === tab.id ? { '--tab-accent': tab.accent } as React.CSSProperties : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {searchAllowed && <div className="top-dock__divider" aria-hidden="true" />}

          {searchAllowed && (
            <button
              className="top-dock__icon-btn"
              onClick={() => setSearchOpen(true)}
              title="Search (Ctrl+K)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}

        </div>
      </header>

      {searchAllowed && searchOpen && <GlobalSearchBar onClose={() => setSearchOpen(false)} />}
    </>
  );
}
