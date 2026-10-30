import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../services/api';

// Exactly four looks: the default follows the computer; the others are fixed.
export type ThemeId = 'system' | 'light' | 'dark' | 'black';
export const THEMES: { id: ThemeId; name: string; description: string }[] = [
  { id: 'system', name: 'Professional (default)', description: 'School green and cream. Switches to dark automatically when your computer is in dark mode.' },
  { id: 'light', name: 'White', description: 'Plain white background. Best in a bright room and for printing.' },
  { id: 'dark', name: 'Dark', description: 'Dark grey. Easier on the eyes in the evening.' },
  { id: 'black', name: 'Extra dark', description: 'Pure black. Lowest brightness; good on phones and in dark rooms.' },
];

const valid = (t: any): t is ThemeId => THEMES.some((x) => x.id === t);

interface ThemeContextType { theme: ThemeId; setTheme: (t: ThemeId, save?: boolean) => void }
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('theme');
    return valid(saved) ? saved : 'system';
  });

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const setTheme = (t: ThemeId, save = true) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    if (save && localStorage.getItem('token')) api.put('/themes', { theme: t }).catch(() => {});
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
