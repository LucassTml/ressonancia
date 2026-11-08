/**
 * Internacionalização simples. O português é o idioma-fonte: `tr('texto')`
 * procura a tradução no catálogo e devolve o próprio texto se não houver.
 * O idioma é fixado no carregamento da página (trocar de idioma recarrega),
 * o que permite usar `tr()` também em constantes de módulo.
 */
export type Lang = 'pt' | 'en';

const KEY = 'res:lang';

function detect(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'pt' || q === 'en') return q;
    const s = localStorage.getItem(KEY);
    if (s === 'pt' || s === 'en') return s;
  } catch {
    /* armazenamento indisponível */
  }
  return typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('pt') ? 'en' : 'pt';
}

export const lang: Lang = detect();
export const locale = lang === 'en' ? 'en-US' : 'pt-BR';

/** Nomes das doze notas, a partir de Dó (C). */
export const NOTE_NAMES = lang === 'en'
  ? ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
  : ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];

const catalog: Record<string, string> = lang === 'en' ? (await import('./en.json')).default : {};

if (typeof document !== 'undefined') document.documentElement.lang = locale;

/** Traduz um texto em português; `{0}`, `{1}`… são substituídos pelos argumentos. */
export function tr(source: string, ...args: (string | number)[]): string {
  const s = catalog[source] ?? source;
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])) : s;
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.toString());
}
