'use client';

import { useCallback, useSyncExternalStore } from 'react';

const preferenceEvent = 'ai-agora:preference-changed';
const volatilePreferences = new Map<string, boolean>();

function readBoolean(key: string, fallback: boolean) {
  const volatileValue = volatilePreferences.get(key);
  if (volatileValue !== undefined) return volatileValue;
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(preferenceEvent, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(preferenceEvent, listener);
  };
}

/** Conserve une préférence d'interface locale tout en gardant un rendu serveur stable. */
export function usePersistentBoolean(key: string, fallback: boolean) {
  const getSnapshot = useCallback(() => readBoolean(key, fallback), [fallback, key]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback(
    (next: boolean) => {
      volatilePreferences.set(key, next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // La préférence reste active pour l'onglet courant si le stockage est indisponible.
      }
      window.dispatchEvent(new Event(preferenceEvent));
    },
    [key],
  );
  return [value, setValue] as const;
}
