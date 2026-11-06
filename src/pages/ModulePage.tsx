import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { modules, type ModuleEntry } from '../content/manifest';
import { hasArticleSource } from '../content/registry';
import { IconArrowRight, IconFlask } from '../components/ui/controls';
import { NotFound } from './NotFound';

function ArticleList({ m, delay = 0 }: { m: ModuleEntry; delay?: number }) {
  return (
    <ol className="border-t border-line">
      {m.articles.map((a, i) => {
        const id = `${m.id}/${a.slug}`;
        const ready = hasArticleSource(id);
        return (
          <motion.li
            key={a.slug}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: delay + i * 0.035, ease: [0.22, 1, 0.36, 1] }}
            className="border-b border-line"
          >
            <Link to={`/${id}`} className="group grid grid-cols-[2.2rem_1fr_auto] gap-x-3 py-5 items-start">
              <span className="font-mono text-[12px] text-faint tabular pt-1">
                {m.number}.{i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-medium tracking-[-0.015em] text-fg group-hover:text-accent transition-colors text-balance">
                  {a.title}
                </span>
                <span className="block mt-1 text-[14px] leading-relaxed text-muted text-pretty">{a.summary}</span>
                <span className="mt-2 flex gap-3 text-[12px] text-faint">
                  {a.labs?.length ? (
                    <span className="inline-flex items-center gap-1">
                      <IconFlask size={13} /> interativo
                    </span>
                  ) : null}
                  {!ready && <span>em preparação</span>}
                </span>
              </span>
              <IconArrowRight
                size={17}
                className="mt-1.5 text-faint opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-accent transition-all"
              />
            </Link>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function ModulePage() {
  const { module = '' } = useParams();
  const m = modules.find((x) => x.id === module);
  useEffect(() => {
    if (m) document.title = `${m.title} — Ressonância`;
  }, [m]);
  if (!m) return <NotFound />;
  return (
    <div className="min-w-0 flex-1 pt-12 sm:pt-16 pb-24">
        <div className="mx-auto max-w-[760px]">
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mb-12"
          >
            <div className="font-mono text-[13px] text-accent tabular">Módulo {m.number}</div>
            <h1 className="mt-2 text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.06] font-semibold tracking-[-0.034em] text-balance">{m.title}</h1>
            <p className="mt-4 text-[1.15rem] leading-relaxed text-muted font-serif max-w-[60ch]">{m.description}</p>
          </motion.header>
          <ArticleList m={m} delay={0.1} />
        </div>
    </div>
  );
}

export function ArticlesIndex() {
  useEffect(() => {
    document.title = 'Artigos — Ressonância';
  }, []);
  return (
    <div className="min-w-0 flex-1 pt-12 sm:pt-16 pb-24">
        <div className="mx-auto max-w-[760px]">
          <header className="mb-14">
            <h1 className="text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.06] font-semibold tracking-[-0.034em]">Todos os artigos</h1>
            <p className="mt-4 text-[1.1rem] leading-relaxed text-muted font-serif max-w-[60ch]">
              Nove módulos que vão da física do ar ao tímpano, do tímpano ao cérebro, e do cérebro de volta à engenharia dos fones.
              Comece por onde quiser: cada artigo explica os conceitos de que precisa e aponta para onde aprofundá-los.
            </p>
          </header>
          <div className="space-y-16">
            {modules.map((m) => (
              <section key={m.id}>
                <Link to={`/${m.id}`} className="group flex items-baseline gap-3 mb-4">
                  <span className="font-mono text-[13px] text-accent tabular">{m.number}</span>
                  <h2 className="text-[22px] font-semibold tracking-[-0.02em] group-hover:text-accent transition-colors">{m.title}</h2>
                </Link>
                <ArticleList m={m} />
              </section>
            ))}
          </div>
        </div>
    </div>
  );
}
