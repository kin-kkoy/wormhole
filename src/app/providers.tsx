import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getSettingsStore } from '../lib/settings-store';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    (async () => {
      try {
        const store = await getSettingsStore();
        const saved = await store.get<string>('theme');
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved);
          document.documentElement.dataset.theme = saved;
        } else {
          document.documentElement.dataset.theme = 'dark';
        }
      } catch {
        document.documentElement.dataset.theme = 'dark';
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      const store = await getSettingsStore();
      await store.set('theme', next);
      await store.save();
    } catch (e) {
      console.error('Failed to persist theme:', e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
