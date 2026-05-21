import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolve(getInitial()));

  useEffect(() => {
    const apply = () => {
      const next = resolve(theme);
      document.documentElement.setAttribute('data-theme', next);
      setResolvedTheme(next);
    };
    apply();
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return { theme, setTheme, resolvedTheme };
}
