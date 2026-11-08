import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AMBIENT_PRESETS, LAYERS, ambientStore, type LayerGroup, type LayerId } from '../../audio/ambient';
import { playingOwnerStore } from '../../audio/engine';
import { useStore } from '../../lib/storage';
import { tr } from '../../i18n';
import { Toggle } from '../ui/controls';

const LAYER_NAME: Record<LayerId, string> = {
  white: tr('Ruído branco'),
  pink: tr('Ruído rosa'),
  brown: tr('Ruído marrom'),
  rain: tr('Chuva'),
  ocean: tr('Mar'),
  wind: tr('Vento'),
  stream: tr('Riacho'),
  fire: tr('Lareira'),
  birds: tr('Pássaros'),
  night: tr('Noite (grilos)'),
  piano: tr('Piano calmo'),
  pads: tr('Acordes suaves'),
  lofi: tr('Lo-fi'),
};

const GROUP_NAME: Record<LayerGroup, string> = { noise: tr('Ruídos'), nature: tr('Natureza'), music: tr('Música calma') };

const PRESET_NAME: Record<string, string> = {
  focus: tr('Foco'),
  rainpiano: tr('Chuva e piano'),
  beach: tr('Praia'),
  cabin: tr('Lareira'),
  forest: tr('Floresta'),
  nightp: tr('Noite'),
  lofirain: tr('Lo-fi na chuva'),
};

export function AmbientButton() {
  const state = useStore(ambientStore);
  const interrupted = useStore(playingOwnerStore) != null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const setLevel = (id: LayerId, v: number) => ambientStore.set((s) => ({ ...s, levels: { ...s.levels, [id]: v } }));
  const anyLayer = LAYERS.some((l) => (state.levels[l.id] ?? 0) > 0.001);
  const playing = state.on && anyLayer && !interrupted;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`h-8 w-8 grid place-items-center rounded-lg transition-colors hover:bg-sunken ${state.on ? 'text-accent' : 'text-muted hover:text-fg'}`}
        title={tr('Som de fundo para leitura')}
        aria-label={tr('Som de fundo para leitura')}
        aria-expanded={open}
      >
        <span className="flex items-end gap-[2px] h-[14px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="w-[2.5px] rounded-full bg-current"
              animate={playing ? { height: ['30%', '100%', '45%', '80%', '30%'] } : { height: ['35%', '75%', '100%', '55%'][i] }}
              transition={playing ? { duration: 1.6 + i * 0.3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
            />
          ))}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={tr('Som de fundo')}
            className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-14 sm:top-10 sm:w-[340px] max-h-[calc(100vh-72px)] overflow-y-auto rounded-2xl border border-line bg-elev shadow-[var(--shadow-pop)] p-4 z-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[14.5px] font-semibold text-fg">{tr('Som de fundo')}</div>
                <p className="text-[12px] text-muted leading-snug">{tr('Para acompanhar a leitura. Pausa sozinho quando um experimento toca.')}</p>
              </div>
              <Toggle checked={state.on} onChange={(v) => ambientStore.set((s) => ({ ...s, on: v }))} label={<span className="sr-only">{tr('Ligar som de fundo')}</span>} />
            </div>
            {state.on && interrupted && <p className="mt-2 text-[12px] text-[var(--warn)]">{tr('Pausado enquanto um experimento toca.')}</p>}
            <label className="mt-3 flex items-center gap-3 text-[12.5px] text-muted">
              {tr('Volume')}
              <input
                type="range"
                className="range flex-1"
                min={0}
                max={1000}
                value={Math.round(state.master * 1000)}
                style={{ ['--pct' as string]: `${state.master * 100}%` }}
                onChange={(e) => ambientStore.set((s) => ({ ...s, master: Number(e.target.value) / 1000 }))}
                aria-label={tr('Volume do som de fundo')}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {AMBIENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => ambientStore.set((s) => ({ ...s, on: true, levels: p.levels }))}
                  className="text-[12px] px-2 py-1 rounded-lg border border-line text-muted hover:text-fg hover:border-line-strong transition-colors"
                >
                  {PRESET_NAME[p.id]}
                </button>
              ))}
            </div>
            {(['noise', 'nature', 'music'] as LayerGroup[]).map((g) => (
              <div key={g} className="mt-4">
                <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-faint mb-1">{GROUP_NAME[g]}</div>
                {LAYERS.filter((l) => l.group === g).map((l) => {
                  const v = state.levels[l.id] ?? 0;
                  return (
                    <label key={l.id} className="grid grid-cols-[110px_1fr] items-center gap-3 text-[12.5px] text-soft h-7">
                      <span className={v > 0 ? 'text-fg' : ''}>{LAYER_NAME[l.id]}</span>
                      <input
                        type="range"
                        className="range"
                        min={0}
                        max={1000}
                        value={Math.round(v * 1000)}
                        style={{ ['--pct' as string]: `${v * 100}%` }}
                        onChange={(e) => {
                          setLevel(l.id, Number(e.target.value) / 1000);
                          if (!state.on) ambientStore.set((s) => ({ ...s, on: true }));
                        }}
                        aria-label={LAYER_NAME[l.id]}
                      />
                    </label>
                  );
                })}
              </div>
            ))}
            <button className="mt-3 text-[12px] text-muted hover:text-fg underline underline-offset-2" onClick={() => ambientStore.set((s) => ({ ...s, levels: {} }))}>
              {tr('Zerar tudo')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
