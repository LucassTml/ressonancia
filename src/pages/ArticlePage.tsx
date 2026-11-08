import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MDXProvider } from '@mdx-js/react';
import { motion } from 'motion/react';
import { allArticles, articleById } from '../content/manifest';
import { hasArticleSource, loadArticle } from '../content/registry';
import { mdxComponents } from '../components/mdx';
import { ReadingProgress, Toc } from '../components/layout/Toc';
import { IconArrowLeft, IconArrowRight, IconBookmark, IconBookmarkFilled, IconFlask } from '../components/ui/controls';
import { useFavorites } from '../lib/prefs';
import { labById } from '../labs';
import { NotFound } from './NotFound';
import { tr } from '../i18n';

export function ArticlePage() {
  const { module = '', slug = '' } = useParams();
  const id = `${module}/${slug}`;
  const entry = articleById.get(id);
  const [Content, setContent] = useState<ComponentType<{ components?: Record<string, unknown> }> | null>(null);
  const [error, setError] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    setContent(null);
    setError(false);
    setMinutes(null);
    if (!entry || !hasArticleSource(id)) return;
    let alive = true;
    loadArticle(id)
      .then((m) => alive && setContent(() => m.default))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id, entry]);

  useEffect(() => {
    if (!Content || !bodyRef.current) return;
    const words = (bodyRef.current.innerText || '').split(/\s+/).length;
    setMinutes(Math.max(1, Math.round(words / 210)));
    if (location.hash) {
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 60);
    }
  }, [Content]);

  useEffect(() => {
    if (entry) document.title = tr("{0} — Ressonância", entry.title);
  }, [entry]);

  if (!entry) return <NotFound />;

  const idx = allArticles.findIndex((a) => a.id === id);
  const prev = allArticles[idx - 1];
  const next = allArticles[idx + 1];
  const fav = isFavorite(id);
  const related = (entry.related ?? []).map((r) => articleById.get(r)).filter(Boolean);
  const usedLabs = (entry.labs ?? []).map((l) => labById.get(l)).filter(Boolean);

  return (
    <>
      <ReadingProgress />
      <article className="article-col min-w-0 flex-1 pt-10 sm:pt-14 pb-24">
        <div className="mx-auto max-w-[720px]">
          <header className="mb-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={`/${entry.module.id}`}
                className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] font-semibold text-accent hover:opacity-80"
              >
                <span className="font-mono tabular">{entry.module.number}</span>
                {entry.module.title}
              </Link>
              <h1 className="mt-3 text-[clamp(2rem,4.4vw,2.9rem)] leading-[1.08] font-semibold tracking-[-0.032em] text-fg text-balance">
                {entry.title}
              </h1>
              <p className="mt-4 text-[1.16rem] leading-relaxed text-muted font-serif text-pretty">{entry.summary}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
                {minutes && <span>{minutes}{' '}{tr("min de leitura")}</span>}
                {usedLabs.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconFlask size={14} /> {usedLabs.length} {usedLabs.length > 1 ? tr("experimentos interativos") : tr("experimento interativo")}
                  </span>
                )}
                <button
                  onClick={() => toggle(id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-sunken ${
                    fav ? 'text-accent' : 'hover:text-fg'
                  }`}
                  aria-pressed={fav}
                >
                  <motion.span key={String(fav)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                    {fav ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} />}
                  </motion.span>
                  {fav ? tr("Salvo nos favoritos") : tr("Salvar nos favoritos")}
                </button>
              </div>
            </motion.div>
          </header>

          <div ref={bodyRef}>
            {error && <p className="text-muted">{tr("Não foi possível carregar este artigo.")}</p>}
            {!hasArticleSource(id) && (
              <p className="prose">{tr("Este artigo ainda está sendo escrito.")}</p>
            )}
            {!Content && !error && hasArticleSource(id) && (
              <div className="space-y-3 animate-pulse" aria-hidden>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-4 rounded bg-sunken" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
                ))}
              </div>
            )}
            {Content && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45 }}
                className="prose"
              >
                <MDXProvider components={mdxComponents}>
                  <Content components={mdxComponents} />
                </MDXProvider>
              </motion.div>
            )}
          </div>

          {(related.length > 0 || prev || next) && (
            <footer className="mt-20 pt-8 border-t border-line font-sans">
              {related.length > 0 && (
                <div className="mb-10">
                  <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-faint mb-3">{tr("Continue explorando")}</div>
                  <ul className="divide-y divide-line border-y border-line">
                    {related.map((r) => (
                      <li key={r!.id}>
                        <Link to={`/${r!.id}`} className="group flex items-center justify-between gap-4 py-3.5">
                          <span className="min-w-0">
                            <span className="block text-[11.5px] text-muted">{r!.module.title}</span>
                            <span className="block text-[15px] text-fg font-medium group-hover:text-accent transition-colors">
                              {r!.title}
                            </span>
                          </span>
                          <IconArrowRight size={16} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {prev ? (
                  <Link to={`/${prev.id}`} className="group rounded-xl p-3 -m-3 hover:bg-sunken transition-colors">
                    <span className="flex items-center gap-1 text-[12px] text-muted">
                      <IconArrowLeft size={13} />{' '}{tr("Anterior")}</span>
                    <span className="block mt-1 text-[14px] font-medium text-fg leading-snug">{prev.title}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link to={`/${next.id}`} className="group text-right rounded-xl p-3 -m-3 hover:bg-sunken transition-colors">
                    <span className="flex items-center justify-end gap-1 text-[12px] text-muted">{tr("Próximo")}{' '}<IconArrowRight size={13} />
                    </span>
                    <span className="block mt-1 text-[14px] font-medium text-fg leading-snug">{next.title}</span>
                  </Link>
                )}
              </div>
            </footer>
          )}
        </div>
      </article>
      <aside className="hidden xl:block w-[220px] shrink-0">
        <div className="sticky top-14 pt-14 max-h-[calc(100vh-56px)] overflow-y-auto pb-10">
          <Toc containerRef={bodyRef} deps={Content} />
        </div>
      </aside>
    </>
  );
}
