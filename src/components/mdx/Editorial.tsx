import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { glossaryById } from '../../content/glossary';
import { articleById } from '../../content/manifest';
import { tr } from '../../i18n';

/* ------------------------------------------------------------------ */
/* Notas laterais                                                      */
/* ------------------------------------------------------------------ */

type CalloutKind = 'simples' | 'nota' | 'mito' | 'atencao' | 'aprofundar' | 'chave' | 'evidencia' | 'simplificacao' | 'preferencia';

const CALLOUT: Record<CalloutKind, { label: string; color: string; bg: string }> = {
  simples: { label: tr('Em palavras simples'), color: 'var(--accent)', bg: 'var(--accent-soft)' },
  nota: { label: tr("Nota"), color: 'var(--fg-muted)', bg: 'var(--bg-sunken)' },
  chave: { label: tr("Ideia central"), color: 'var(--accent)', bg: 'var(--accent-soft)' },
  mito: { label: tr("Equívoco comum"), color: 'var(--myth)', bg: 'var(--myth-soft)' },
  atencao: { label: tr("Atenção"), color: 'var(--warn)', bg: 'var(--warn-soft)' },
  aprofundar: { label: tr("Para aprofundar"), color: 'var(--c-target)', bg: 'var(--info-soft)' },
  evidencia: { label: tr("O que diz a evidência"), color: 'var(--accent)', bg: 'var(--accent-soft)' },
  simplificacao: { label: tr("Simplificação didática"), color: 'var(--c-target)', bg: 'var(--info-soft)' },
  preferencia: { label: tr("Preferência, não fato"), color: 'var(--c-b)', bg: 'var(--warn-soft)' },
};

export function Callout({ type = 'nota', title, children }: { type?: CalloutKind; title?: string; children: ReactNode }) {
  const c = CALLOUT[type];
  return (
    <aside
      className="not-prose my-8 rounded-xl px-5 py-4 font-sans"
      style={{ background: c.bg, boxShadow: `inset 2px 0 0 ${c.color}` }}
    >
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-1.5" style={{ color: c.color }}>
        {c.label}
        {title ? <span className="normal-case tracking-normal text-fg font-semibold text-[14.5px] ml-2">{title}</span> : null}
      </div>
      <div className="callout-body text-[15.5px] leading-[1.65] text-soft [&_p+p]:mt-2.5 [&_strong]:text-fg [&_strong]:font-semibold [&_a]:underline [&_a]:decoration-[var(--accent)] [&_a]:underline-offset-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li+li]:mt-1 [&_.katex]:text-[1em]">
        {children}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Termo do glossário com definição contextual                         */
/* ------------------------------------------------------------------ */

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = glossaryById[id];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const tid = useId();
  const timer = useRef<number>();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!entry) return <>{children}</>;
  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    timer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <span ref={ref} className="relative inline" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-describedby={open ? tid : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={show}
        onBlur={hide}
        className="inline text-left font-[inherit] text-[inherit] leading-[inherit] border-b border-dotted border-[var(--fg-faint)] hover:border-[var(--accent)] hover:text-fg transition-colors"
      >
        {children ?? entry.term}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={tid}
            role="tooltip"
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-40 w-[min(320px,80vw)] rounded-xl border border-line bg-elev px-4 py-3 text-left font-sans shadow-[var(--shadow-pop)] block"
          >
            <span className="block text-[13px] font-semibold text-fg mb-1">{entry.term}</span>
            <span className="block text-[13px] leading-relaxed text-soft font-normal">{entry.def}</span>
            <span className="mt-2 flex gap-3 text-[12px]">
              <Link to={`/glossario#${entry.id}`} className="text-accent hover:underline">{tr("Glossário")}</Link>
              {entry.see && articleById.get(entry.see) && (
                <Link to={`/${entry.see}`} className="text-accent hover:underline truncate">
                  {articleById.get(entry.see)!.title}
                </Link>
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Figuras, fórmulas comentadas, referências                           */
/* ------------------------------------------------------------------ */

export function Figure({ caption, children, wide }: { caption?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`not-prose my-10 font-sans ${wide ? 'bleed' : ''}`}
    >
      <div className="rounded-[18px] border border-line bg-elev p-4 sm:p-5">{children}</div>
      {caption && <figcaption className="mt-2.5 px-1 text-[13px] leading-relaxed text-muted">{caption}</figcaption>}
    </motion.figure>
  );
}

/** Lista "variável → significado" que acompanha uma fórmula. */
export function Vars({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="not-prose my-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 font-sans text-[14.5px] rounded-xl border border-line px-5 py-3.5">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-fg font-medium whitespace-nowrap">{k}</dt>
          <dd className="text-soft leading-relaxed">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function References({ children }: { children: ReactNode }) {
  return (
    <section className="not-prose mt-16 pt-6 border-t border-line font-sans" aria-labelledby="refs">
      <h2 id="refs" className="text-[13px] uppercase tracking-[0.12em] font-semibold text-muted mb-4">{tr("Referências e leituras")}</h2>
      <ol className="refs space-y-2.5 text-[13.5px] leading-relaxed text-soft list-decimal pl-5 marker:text-faint [&_em]:italic [&_a]:text-accent [&_a]:break-all">
        {children}
      </ol>
    </section>
  );
}

export function Ref({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

/** Destaque numérico curto no meio da prosa. */
export function KeyNumbers({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="not-prose my-8 grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-px rounded-xl overflow-hidden border border-line bg-line font-sans">
      {items.map((it) => (
        <div key={it.label} className="bg-elev px-4 py-3.5">
          <div className="text-[22px] font-semibold tracking-[-0.02em] text-fg tabular">{it.value}</div>
          <div className="text-[12.5px] text-muted leading-snug mt-0.5">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <div className="lead">{children}</div>;
}
