import { Suspense, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { labById, labs } from '../labs';
import { modules, articleById } from '../content/manifest';
import { Lab, LabSkeleton } from '../components/mdx/LabEmbed';
import { IconArrowLeft, IconArrowRight, IconVolume } from '../components/ui/controls';
import { NotFound } from './NotFound';
import { tr } from '../i18n';

export function LabsPage() {
  useEffect(() => {
    document.title = tr("Laboratório — Ressonância");
  }, []);
  const visible = labs.filter((l) => !l.hidden);
  const featured = visible.filter((l) => l.featured);
  return (
    <div className="mx-auto max-w-[1180px] px-4 sm:px-6 pt-12 sm:pt-16 pb-24">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[720px] mb-14"
      >
        <div className="text-[12px] uppercase tracking-[0.12em] font-semibold text-accent">{tr("Laboratório central")}</div>
        <h1 className="mt-2 text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.06] font-semibold tracking-[-0.034em]">{tr("Experimente o som com as próprias mãos")}</h1>
        <p className="mt-4 text-[1.12rem] leading-relaxed text-muted font-serif">{tr("Todos os simuladores do site reunidos. Os cálculos são reais e o áudio é gerado e processado no seu navegador pela Web Audio API — nada é enviado a servidores. Cada experimento leva ao artigo que explica o fenômeno.")}</p>
      </motion.header>

      {featured.length > 0 && (
        <section className="mb-16">
          <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-faint mb-4">{tr("Destaques")}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-line bg-line">
            {featured.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="bg-bg"
              >
                <Link to={`/laboratorio/${l.id}`} className="group block h-full p-5 hover:bg-elev transition-colors">
                  <div className="flex items-center justify-between text-[11.5px] text-muted">
                    <span>{modules.find((m) => m.id === l.module)?.short}</span>
                    {l.audio && <IconVolume size={14} className="text-faint" />}
                  </div>
                  <div className="mt-3 text-[16px] font-medium tracking-[-0.015em] text-fg group-hover:text-accent transition-colors">
                    {l.title}
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{l.summary}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-12">
        {modules.map((m) => {
          const ls = visible.filter((l) => l.module === m.id);
          if (!ls.length) return null;
          return (
            <section key={m.id}>
              <h2 className="flex items-baseline gap-3 mb-3">
                <span className="font-mono text-[13px] text-accent tabular">{m.number}</span>
                <span className="text-[19px] font-semibold tracking-[-0.02em]">{m.title}</span>
              </h2>
              <ul className="border-t border-line">
                {ls.map((l) => (
                  <li key={l.id} className="border-b border-line">
                    <Link to={`/laboratorio/${l.id}`} className="group grid sm:grid-cols-[minmax(0,300px)_1fr_auto] gap-x-6 gap-y-1 py-4 items-baseline">
                      <span className="text-[15px] font-medium text-fg group-hover:text-accent transition-colors inline-flex items-center gap-2">
                        {l.title}
                        {l.audio && <IconVolume size={13} className="text-faint" />}
                      </span>
                      <span className="text-[13.5px] text-muted leading-relaxed">{l.summary}</span>
                      <IconArrowRight size={16} className="hidden sm:block text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function LabPage() {
  const { lab = '' } = useParams();
  const l = labById.get(lab);
  useEffect(() => {
    if (l) document.title = tr("{0} — Laboratório — Ressonância", l.title);
  }, [l]);
  if (!l) return <NotFound />;
  const art = articleById.get(l.article);
  return (
    <div className="mx-auto max-w-[1060px] px-4 sm:px-6 pt-10 pb-24">
      <Link to="/laboratorio" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <IconArrowLeft size={14} />{' '}{tr("Laboratório")}</Link>
      <h1 className="mt-4 text-[clamp(1.8rem,3.8vw,2.5rem)] font-semibold tracking-[-0.03em]">{l.title}</h1>
      <p className="mt-2 text-[1.05rem] text-muted font-serif max-w-[65ch]">{l.summary}</p>
      <div className="[&_.bleed]:mx-0">
        <Suspense fallback={<LabSkeleton />}>
          <Lab id={l.id} />
        </Suspense>
      </div>
      {art && (
        <Link to={`/${art.id}`} className="group mt-4 flex items-center justify-between gap-4 rounded-2xl border border-line px-5 py-4 hover:bg-elev transition-colors">
          <span>
            <span className="block text-[12px] text-muted">{tr("Entenda o fenômeno")}</span>
            <span className="block text-[15.5px] font-medium text-fg group-hover:text-accent transition-colors">{art.title}</span>
          </span>
          <IconArrowRight size={17} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
        </Link>
      )}
    </div>
  );
}
