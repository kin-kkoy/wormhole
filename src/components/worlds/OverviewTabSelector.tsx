import { useAppStore, type OverviewTab } from '../../state/store';
import './OverviewTabSelector.css';

const TABS: { id: OverviewTab; label: string; accent: string }[] = [
  { id: 'atlas', label: 'Atlas', accent: 'var(--accent-atlas)' },
  { id: 'characters', label: 'Characters', accent: 'var(--accent-characters)' },
  { id: 'lore', label: 'Lore', accent: 'var(--accent-lore)' },
];

export function OverviewTabSelector() {
  const overviewTab = useAppStore((s) => s.overviewTab);
  const setOverviewTab = useAppStore((s) => s.setOverviewTab);

  return (
    <div className="overview-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`overview-tabs__tab ${overviewTab === tab.id ? 'overview-tabs__tab--active' : ''}`}
          style={overviewTab === tab.id ? { '--tab-accent': tab.accent } as React.CSSProperties : undefined}
          onClick={() => setOverviewTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
