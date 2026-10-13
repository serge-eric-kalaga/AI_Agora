'use client';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { t } from '@/i18n';

const key = 'ai-agora.ui.theme';
function readTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
function subscribe(callback: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === key) {
      document.documentElement.dataset.theme = event.newValue === 'light' ? 'light' : 'dark';
      callback();
    }
  };
  window.addEventListener('storage', sync);
  window.addEventListener('agora-theme', callback);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener('agora-theme', callback);
  };
}
export function ThemeButton() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as const);
  return (
    <button
      className="icon-button theme-button"
      aria-label={theme === 'dark' ? t.design.lightTheme : t.design.darkTheme}
      title={theme === 'dark' ? t.design.lightTheme : t.design.darkTheme}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        // Le thème reste utilisable même si le navigateur refuse le stockage.
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(key, next);
        } catch {
          /* Préférence limitée à cette page. */
        }
        window.dispatchEvent(new Event('agora-theme'));
      }}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
