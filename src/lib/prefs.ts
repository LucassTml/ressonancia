import { createPersistentStore, useStore } from './storage';

export type Theme = 'light' | 'dark';

export const themeStore = createPersistentStore<Theme>('theme-pref', 'light');
// versões anteriores podiam guardar 'system'; qualquer valor diferente de 'dark' vira o tema claro padrão
if (themeStore.get() !== 'dark') themeStore.set('light');
export const favoritesStore = createPersistentStore<string[]>('favorites', []);
export const audioNoticeStore = createPersistentStore<boolean>('audio-notice-ack', false);

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0d10' : '#ffffff');
  try {
    localStorage.setItem('res:theme', theme);
  } catch {
    /* ignore */
  }
}

export function useTheme() {
  return useStore(themeStore);
}

export function resolvedTheme(): Theme {
  return themeStore.get();
}

export function useFavorites() {
  const favs = useStore(favoritesStore);
  return {
    favorites: favs,
    isFavorite: (id: string) => favs.includes(id),
    toggle: (id: string) =>
      favoritesStore.set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev])),
  };
}
