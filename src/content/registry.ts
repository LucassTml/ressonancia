import type { ComponentType } from 'react';
import { allArticles } from './manifest';
import { lang } from '../i18n';

type MDXModule = { default: ComponentType<{ components?: Record<string, unknown> }> };

const allLoaders = import.meta.glob<MDXModule>(['./articles/*/*.mdx', './articles-en/*/*.mdx']);
const allRaw = import.meta.glob<string>(['./articles/*/*.mdx', './articles-en/*/*.mdx'], { query: '?raw', import: 'default' });

/** Caminho do artigo no idioma atual; cai no português se ainda não houver tradução. */
function pathOf(id: string) {
  const en = `./articles-en/${id}.mdx`;
  return lang === 'en' && en in allLoaders ? en : `./articles/${id}.mdx`;
}

export function hasArticleSource(id: string) {
  return pathOf(id) in allLoaders;
}

export function loadArticle(id: string) {
  const loader = allLoaders[pathOf(id)];
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
        .map(async (a) => [a.id, stripMdx(await allRaw[pathOf(a.id)]())] as const),
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
