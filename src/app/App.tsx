import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './providers';
import { WorldIndex } from '../features/worlds/WorldIndex';
import { WorldShell } from '../features/worlds/WorldShell';
import '../styles/global.css';

export default function App() {
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
