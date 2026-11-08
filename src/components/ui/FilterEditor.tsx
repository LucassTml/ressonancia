import { AnimatePresence, motion } from 'motion/react';
import type { FilterSpec, FilterType } from '../../audio/dsp';
import { qToOctaves } from '../../audio/dsp';
import { Button, IconPlus, IconTrash, Slider, fmtHz, fmtNum } from './controls';
import { tr } from '../../i18n';

export const FILTER_LABEL: Record<FilterType, string> = {
  peaking: 'Peak (sino)',
  lowshelf: 'Low shelf',
  highshelf: 'High shelf',
  lowpass: 'Passa-baixas',
  highpass: 'Passa-altas',
  bandpass: 'Passa-faixa',
  notch: 'Notch',
};

const hasGain = (t: FilterType) => t === 'peaking' || t === 'lowshelf' || t === 'highshelf';
const hasQ = (t: FilterType) => t !== 'lowshelf' && t !== 'highshelf';

let seq = 0;
export const newFilter = (p: Partial<FilterSpec> = {}): FilterSpec => ({
  id: `f${Date.now().toString(36)}${seq++}`,
  type: 'peaking',
  freq: 1000,
  gain: 0,
  q: 1,
  enabled: true,
  ...p,
});

export const FILTER_COLORS = ['#e8795f', '#5fb3e8', '#c79bf2', '#e8c35f', '#6fd39a', '#f28bb3', '#8fa3f5', '#d6a06b'];

export function FilterEditor({
  filters,
  onChange,
  max = 8,
  types = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch'],
  compact,
}: {
  filters: FilterSpec[];
  onChange: (f: FilterSpec[]) => void;
  max?: number;
  types?: FilterType[];
  compact?: boolean;
}) {
  const update = (id: string, p: Partial<FilterSpec>) => onChange(filters.map((f) => (f.id === id ? { ...f, ...p } : f)));
  return (
    <div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {filters.map((f, i) => (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className={`rounded-xl border border-line px-3.5 py-3 ${f.enabled === false ? 'opacity-50' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: FILTER_COLORS[i % FILTER_COLORS.length] }} />
                  <span className="text-[12px] font-mono text-muted">#{i + 1}</span>
                  <select
                    value={f.type}
                    onChange={(e) => {
                      const t = e.target.value as FilterType;
                      update(f.id, { type: t, q: t === 'lowpass' || t === 'highpass' ? 0.707 : t === 'lowshelf' || t === 'highshelf' ? 0.707 : f.q });
                    }}
                    className="h-7 rounded-md border border-line-strong bg-elev px-1.5 text-[12.5px]"
                    aria-label={tr("Tipo do filtro {0}", i + 1)}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {FILTER_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-[12px] text-muted ml-1 cursor-pointer">
                    <input type="checkbox" checked={f.enabled !== false} onChange={(e) => update(f.id, { enabled: e.target.checked })} className="accent-[var(--accent)]" />{tr("ativo")}</label>
                  <button
                    onClick={() => onChange(filters.filter((x) => x.id !== f.id))}
                    className="ml-auto h-7 w-7 grid place-items-center rounded-md text-faint hover:text-[var(--myth)] hover:bg-sunken"
                    aria-label={tr("Remover filtro {0}", i + 1)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
                <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3'} gap-x-5 gap-y-2`}>
                  <Slider label={tr("Frequência")} value={f.freq} min={20} max={20000} log onChange={(v) => update(f.id, { freq: Math.round(v) })} format={fmtHz} />
                  <Slider label={tr("Ganho")} value={f.gain} min={-15} max={15} step={0.1} onChange={(v) => update(f.id, { gain: v })} format={(v) => `${v > 0 ? '+' : ''}${fmtNum(v, 1)}`} unit="dB" disabled={!hasGain(f.type)} />
                  <Slider
                    label="Q"
                    value={f.q}
                    min={0.2}
                    max={12}
                    log
                    onChange={(v) => update(f.id, { q: Number(v.toFixed(2)) })}
                    format={(v) => fmtNum(v, 2)}
                    hint={hasQ(f.type) && f.type === 'peaking' ? tr("≈ {0} oitava", fmtNum(qToOctaves(f.q), 2)) : !hasQ(f.type) ? tr("Inclinação fixa (S = 1)") : undefined}
                    disabled={!hasQ(f.type)}
                  />
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {filters.length < max && (
        <Button size="sm" variant="ghost" className="mt-2" icon={<IconPlus size={14} />} onClick={() => onChange([...filters, newFilter()])}>{tr("Adicionar filtro")}</Button>
      )}
    </div>
  );
}

/** Exporta filtros no formato do Equalizer APO (Windows), compatível com Peace e outros. */
export function toEqualizerAPO(filters: FilterSpec[], preamp: number) {
  const code: Record<FilterType, string> = { peaking: 'PK', lowshelf: 'LSC', highshelf: 'HSC', lowpass: 'LPQ', highpass: 'HPQ', bandpass: 'BP', notch: 'NO' };
  const lines = [`Preamp: ${preamp.toFixed(1)} dB`];
  filters
    .filter((f) => f.enabled !== false)
    .forEach((f, i) => {
      const g = f.type === 'peaking' || f.type === 'lowshelf' || f.type === 'highshelf' ? ` Gain ${f.gain.toFixed(1)} dB` : '';
      lines.push(`Filter ${i + 1}: ON ${code[f.type]} Fc ${Math.round(f.freq)} Hz${g} Q ${f.q.toFixed(2)}`);
    });
  return lines.join('\n');
}
