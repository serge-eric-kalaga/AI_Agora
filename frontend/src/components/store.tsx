'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { transition, type Command, type Envelope } from '@/domain/engine';
import type { AgoraState } from '@/domain/models';
import { LocalAgoraRepository } from '@/data/repository';
import { seed } from '@/data/seed';
import { t } from '@/i18n';
const repository = new LocalAgoraRepository();
type Store = {
  state: AgoraState;
  ready: boolean;
  dispatch: (command: Command) => void;
  storageWarning: string;
  toast: string;
  notify: (text: string) => void;
};
const Context = createContext<Store | null>(null);
function reducer(state: AgoraState, action: Envelope | { hydrate: AgoraState }) {
  return 'hydrate' in action ? action.hydrate : transition(state, action);
}
export function AgoraProvider({ children }: { children: ReactNode }) {
  const [state, send] = useReducer(reducer, seed);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const [toast, notify] = useState('');
  useEffect(() => {
    let cancelled = false;
    repository
      .load()
      .then((result) => {
        if (!cancelled) {
          send({ hydrate: result.state });
          if (result.recovered) setStorageWarning(t.shell.storageInvalid);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStorageWarning(t.shell.storageError);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (ready) repository.save(state).catch(() => setStorageWarning(t.shell.storageError));
  }, [state, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => notify(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const dispatch = useCallback((command: Command) => {
    send({ command, id: crypto.randomUUID(), now: new Date().toISOString() });
  }, []);
  return (
    <Context.Provider value={{ state, ready, dispatch, storageWarning, toast, notify }}>
      {children}
    </Context.Provider>
  );
}
export function useAgora() {
  const store = useContext(Context);
  if (!store) throw new Error('AgoraProvider missing');
  return store;
}
