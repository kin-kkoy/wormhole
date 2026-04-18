import { useEffect, useState } from 'react';
import { useAppStore, type TabId } from '../../state/store';
import { useTheme } from '../../app/providers';
import { GlobalSearchBar } from './GlobalSearchBar';
import { RecycleBinDialog } from './RecycleBinDialog';
import './TopDock.css';

// Tabs that support edit mode in overview
const EDITABLE_OVERVIEW_TABS = new Set(['atlas', 'characters']);

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
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const overviewTab = useAppStore((s) => s.overviewTab);
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);

  const showEditButton =
    (activeTab === 'overview' && EDITABLE_OVERVIEW_TABS.has(overviewTab)) ||
    activeTab === 'characters';

  // Global search is only meaningful on Overview and Atlas Canvas.
  // Character Codex has its own in-list search, and Lore Archive has a
  // scoped folder-tree search — no need for a duplicate global bar there.
  const searchAllowed = activeTab === 'overview' || activeTab === 'atlas';

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

          <div className="top-dock__divider" aria-hidden="true" />

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

          <button
            className="top-dock__icon-btn"
            onClick={() => setBinOpen(true)}
            title="Recycle Bin"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 5h10M6.5 5V3.5a1 1 0 011-1h1a1 1 0 011 1V5M4.5 5v8a1.5 1.5 0 001.5 1.5h4A1.5 1.5 0 0011.5 13V5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {showEditButton && (
            <button
              className={`top-dock__edit-toggle ${editMode ? 'top-dock__edit-toggle--active' : ''}`}
              onClick={() => setEditMode(!editMode)}
              title={editMode ? 'Exit edit mode' : 'Edit mode'}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M13.5 2.5l2 2-9 9H4.5v-2l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {editMode && <path d="M11 5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
              </svg>
            </button>
          )}

          <button
            className="top-dock__theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 2V3.5M9 14.5V16M16 9H14.5M3.5 9H2M13.95 4.05L12.89 5.11M5.11 12.89L4.05 13.95M13.95 13.95L12.89 12.89M5.11 5.11L4.05 4.05" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M15.5 10.4a6.5 6.5 0 01-7.9-7.9A6.5 6.5 0 1015.5 10.4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {searchAllowed && searchOpen && <GlobalSearchBar onClose={() => setSearchOpen(false)} />}
      {binOpen && <RecycleBinDialog onClose={() => setBinOpen(false)} />}
    </>
  );
}
