import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { WorldIndex } from '../features/worlds/WorldIndex';
import { WorldShell } from '../features/worlds/WorldShell';
import { useAppStore } from '../state/store';
import '../styles/global.css';

export default function App() {
  const loadLoreMode = useAppStore((s) => s.loadLoreMode);
  const loadReaderLayout = useAppStore((s) => s.loadReaderLayout);
  const loadTocCollapsed = useAppStore((s) => s.loadTocCollapsed);
  useEffect(() => {
    loadLoreMode();
    loadReaderLayout();
    loadTocCollapsed();
  }, [loadLoreMode, loadReaderLayout, loadTocCollapsed]);

  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route path="/" element={<WorldIndex />} />
          <Route path="/world/:worldId" element={<WorldShell />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}
