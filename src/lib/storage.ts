import { useSyncExternalStore } from 'react';

/**
 * Pequena camada de persistência local. Toda leitura/escrita é protegida por
 * try/catch: em janelas privadas ou com armazenamento bloqueado o site
 * continua funcionando, apenas sem lembrar das preferências.
 */
const PREFIX = 'res:';

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Store reativa mínima persistida em localStorage. */
export function createPersistentStore<T>(key: string, initial: T) {
  let state = readLocal<T>(key, initial);
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      writeLocal(key, state);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useStore<T>(store: { get: () => T; subscribe: (l: () => void) => () => void }) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
