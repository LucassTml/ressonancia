import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Button, IconReset } from './controls';
import { AudioNotice } from './audio';
import { tr } from '../../i18n';

interface LabFrameProps {
  title: string;
  kicker?: string;
  description?: ReactNode;
  onReset?: () => void;
  audio?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  toolbar?: ReactNode;
  wide?: boolean;
}

/**
 * Moldura comum dos laboratórios: título, ações e área de conteúdo.
 * Integra-se à leitura (largura estendida opcional) sem virar um "card".
 */
export function LabFrame({ title, kicker = tr('Laboratório'), description, onReset, audio, children, footer, toolbar, wide = true }: LabFrameProps) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`not-prose my-10 font-sans ${wide ? 'bleed' : ''}`}
    >
      <div className="rounded-[18px] border border-line bg-elev overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.12em] text-accent font-semibold mb-0.5">{kicker}</div>
            <h3 className="text-[16.5px] font-semibold tracking-[-0.015em] text-fg">{title}</h3>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-muted max-w-[62ch]">{description}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            {toolbar}
            {onReset && (
              <Button size="sm" variant="ghost" onClick={onReset} icon={<IconReset size={14} />} title={tr("Restaurar valores iniciais")}>{tr("Restaurar")}</Button>
            )}
          </div>
        </header>
        <div className="px-5 py-4">{children}</div>
        {(audio || footer) && (
          <footer className="px-5 py-3 border-t border-line bg-sunken/60 flex flex-col gap-2">
            {footer && <div className="text-[12.5px] leading-relaxed text-muted">{footer}</div>}
            {audio && <AudioNotice />}
          </footer>
        )}
      </div>
    </motion.figure>
  );
}

/** Grade responsiva de controles. */
export function Controls({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 ${c} gap-x-6 gap-y-3`}>{children}</div>;
}

/** Bloco de leitura de valores calculados. */
export function Readout({ items }: { items: { label: ReactNode; value: ReactNode; hint?: ReactNode; accent?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px rounded-xl overflow-hidden border border-line bg-line">
      {items.map((it, i) => (
        <div key={i} className="bg-elev px-3.5 py-2.5 min-w-0">
          <dt className="text-[11.5px] text-muted leading-tight">{it.label}</dt>
          <dd className={`mt-0.5 font-mono tabular text-[15px] ${it.accent ? 'text-accent' : 'text-fg'} truncate`}>{it.value}</dd>
          {it.hint && <dd className="text-[11px] text-faint leading-snug mt-0.5">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] leading-relaxed text-muted">{children}</p>;
}
