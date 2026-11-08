import { Suspense, lazy, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayback } from '../ui/audio';
import { IconChevron, IconPlay, IconStop } from '../ui/controls';
import { dbToGain, pinkNoiseBuffer } from '../../audio/engine';
import { tr } from '../../i18n';

const LazyDiagram = lazy(() => import('./Diagrams'));
const LazyGallery = lazy(() => import('./IemGallery'));

export function IemGallery({ tier }: { tier: 'budget' | 'mid' | 'high' | 'top' }) {
  return (
    <Suspense fallback={<div className="not-prose my-8 h-[300px] rounded-[18px] border border-line bg-elev" />}>
      <LazyGallery tier={tier} />
    </Suspense>
  );
}

export function Diagram({ id }: { id: string }) {
  return (
    <Suspense fallback={<div className="not-prose my-9 h-[180px] rounded-[18px] border border-line bg-elev" />}>
      <LazyDiagram id={id} />
    </Suspense>
  );
}

/**
 * Fórmula recolhida: a ideia aparece em palavras e a matemática fica a um clique.
 * <Formula say="Em palavras…"> $$…$$ <Vars …/> </Formula>
 */
export function Formula({ say, children }: { say: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="not-prose my-6 rounded-xl border border-line font-sans">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <p className="text-[15px] leading-relaxed text-soft">{say}</p>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:opacity-80 mt-1 whitespace-nowrap"
        >
          <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}>
            <IconChevron size={12} />
          </motion.span>
          {open ? tr('Ocultar a fórmula') : tr('Ver a fórmula')}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2 border-t border-line prose [&_.katex-display]:my-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Botão “ouça” dentro do texto. `f` é uma lista de frequências (Hz) tocadas em
 * sequência; com `together` soam juntas; `noise` toca ruído rosa filtrado.
 */
export function Listen({
  label,
  f,
  together,
  wave = 'sine',
  dur = 0.9,
  noise,
}: {
  label: string;
  f?: string;
  together?: boolean;
  wave?: OscillatorType;
  dur?: number;
  noise?: string;
}) {
  const pb = usePlayback('listen');
  const play = () => {
    if (pb.playing) return pb.stop();
    pb.start((ctx, out) => {
      const master = ctx.createGain();
      master.gain.value = dbToGain(wave === 'sine' ? -22 : -30);
      master.connect(out);
      const stops: AudioScheduledSourceNode[] = [];
      let total = dur;
      if (noise) {
        const [lo, hi] = noise.split('-').map(Number);
        const s = ctx.createBufferSource();
        s.buffer = pinkNoiseBuffer(ctx);
        s.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = lo;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = hi;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(3, ctx.currentTime + 0.05);
        g.gain.setValueAtTime(3, ctx.currentTime + dur);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur + 0.08);
        s.connect(hp).connect(lp).connect(g).connect(master);
        s.start();
        s.stop(ctx.currentTime + dur + 0.1);
        stops.push(s);
      } else {
        const freqs = (f ?? '440').split(',').map(Number);
        total = together ? dur : freqs.length * dur;
        freqs.forEach((fr, i) => {
          const t0 = ctx.currentTime + 0.02 + (together ? 0 : i * dur);
          const o = ctx.createOscillator();
          o.type = wave;
          o.frequency.value = fr;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(together ? 0.6 : 1, t0 + 0.02);
          g.gain.setValueAtTime(together ? 0.6 : 1, t0 + dur - 0.08);
          g.gain.linearRampToValueAtTime(0, t0 + dur - 0.01);
          o.connect(g).connect(master);
          o.start(t0);
          o.stop(t0 + dur);
          stops.push(o);
        });
      }
      const id = window.setTimeout(() => pb.stop(), (total + 0.15) * 1000);
      return () => {
        window.clearTimeout(id);
        stops.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* já parado */
          }
        });
      };
    });
  };
  return (
    <button
      onClick={play}
      className={`not-prose inline-flex items-center gap-1.5 align-baseline mx-0.5 px-2.5 py-[3px] rounded-full border text-[13px] font-sans font-medium leading-tight transition-colors ${
        pb.playing ? 'border-accent text-accent bg-accent-soft' : 'border-line-strong text-fg hover:bg-sunken'
      }`}
      aria-pressed={pb.playing}
    >
      {pb.playing ? <IconStop size={10} /> : <IconPlay size={10} />}
      {label}
    </button>
  );
}
