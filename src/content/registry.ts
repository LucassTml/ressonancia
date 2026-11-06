import type { ComponentType } from 'react';
import { allArticles } from './manifest';

type MDXModule = { default: ComponentType<{ components?: Record<string, unknown> }> };

const loaders = import.meta.glob<MDXModule>('./articles/*/*.mdx');
const rawLoaders = import.meta.glob<string>('./articles/*/*.mdx', { query: '?raw', import: 'default' });

export function hasArticleSource(id: string) {
  return `./articles/${id}.mdx` in loaders;
}

export function loadArticle(id: string) {
  const loader = loaders[`./articles/${id}.mdx`];
  if (!loader) return Promise.reject(new Error(`Artigo não encontrado: ${id}`));
  return loader();
}

/** Texto plano de todos os artigos para a busca. Carregado só na primeira busca. */
let rawCache: Promise<Map<string, string>> | null = null;
export function loadAllRaw() {
  if (!rawCache) {
    rawCache = Promise.all(
      allArticles
        .filter((a) => hasArticleSource(a.id))
        .map(async (a) => [a.id, stripMdx(await rawLoaders[`./articles/${a.id}.mdx`]())] as const),
    ).then((entries) => new Map(entries));
  }
  return rawCache;
}

function stripMdx(src: string) {
  return src
    .replace(/^import .*$/gm, '')
    .replace(/^export .*$/gm, '')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
