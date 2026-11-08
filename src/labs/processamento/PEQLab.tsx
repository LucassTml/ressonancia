import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { Button, IconCopy, Slider, Toggle, fmtDb, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FILTER_COLORS, FilterEditor, newFilter, toEqualizerAPO } from '../../components/ui/FilterEditor';
import { FreqPlot, Legend, type PlotScales } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, filtersDbAt, logFreqs, type FilterSpec } from '../../audio/dsp';
import { useBiquadChain, type ChainTaps } from '../../audio/useBiquadChain';
import { useAnimationFrame } from '../../lib/hooks';
import { tr } from '../../i18n';

const PRESETS: { name: string; filters: Omit<FilterSpec, 'id'>[] }[] = [
  { name: tr("Mais grave"), filters: [{ type: 'lowshelf', freq: 105, gain: 5, q: 0.707 }] },
  { name: tr("Menos sibilância"), filters: [{ type: 'peaking', freq: 7200, gain: -5, q: 3.5 }] },
  { name: tr("Vozes mais à frente"), filters: [{ type: 'peaking', freq: 2200, gain: 2.5, q: 0.9 }, { type: 'peaking', freq: 350, gain: -1.5, q: 0.9 }] },
  { name: tr("Suavizar agudos"), filters: [{ type: 'highshelf', freq: 5000, gain: -3, q: 0.707 }] },
  { name: tr("Em V (diversão)"), filters: [{ type: 'lowshelf', freq: 120, gain: 6, q: 0.707 }, { type: 'peaking', freq: 1500, gain: -3, q: 0.6 }, { type: 'highshelf', freq: 8000, gain: 4, q: 0.707 }] },
];

const INITIAL: FilterSpec[] = [
  newFilter({ type: 'lowshelf', freq: 105, gain: 4, q: 0.707 }),
  newFilter({ type: 'peaking', freq: 3000, gain: -2, q: 1.2 }),
  newFilter({ type: 'peaking', freq: 7500, gain: -3, q: 4 }),
];

export default function PEQLab() {
  const [filters, setFilters] = useState<FilterSpec[]>(INITIAL);
  const [enabled, setEnabled] = useState(true);
  const [autoPre, setAutoPre] = useState(true);
  const [manualPre, setManualPre] = useState(0);
  const [hardClip, setHardClip] = useState(true);
  const [clipFlash, setClipFlash] = useState(0);
  const [taps, setTaps] = useState<ChainTaps | null>(null);
  const [copied, setCopied] = useState(false);
  const specRef = useRef<{ pre: Float32Array<ArrayBuffer>; post: Float32Array<ArrayBuffer> } | null>(null);
  const [, force] = useState(0);
  const drag = useRef<string | null>(null);

  const total = useMemo(() => (f: number) => filtersDbAt(filters, f), [filters]);
  const maxBoost = useMemo(() => Math.max(0, ...logFreqs(240).map(total)), [total]);
  const preamp = autoPre ? -Math.ceil(maxBoost * 10) / 10 : manualPre;

  const onClip = useCallback(() => setClipFlash(Date.now()), []);
  const player = useBiquadChain('peq', filters, { enabled, preampDb: preamp, hardClip, onTaps: setTaps, onClip });

  // espectro ao vivo
  useAnimationFrame(() => {
    if (!taps) return;
    if (!specRef.current || specRef.current.pre.length !== taps.pre.frequencyBinCount)
      specRef.current = { pre: new Float32Array(taps.pre.frequencyBinCount), post: new Float32Array(taps.post.frequencyBinCount) };
    taps.pre.getFloatFrequencyData(specRef.current.pre);
    taps.post.getFloatFrequencyData(specRef.current.post);
    force((x) => (x + 1) % 1000);
  }, !!taps);

  const specFn = (which: 'pre' | 'post') => (f: number) => {
    const s = specRef.current?.[which];
    if (!s || !taps) return -200;
    const sr = taps.pre.context.sampleRate;
    const k = Math.round((f * taps.pre.fftSize) / sr);
    let m = -200;
    for (let j = Math.max(1, k - 2); j <= Math.min(s.length - 1, k + 2); j++) m = Math.max(m, s[j]);
    return (m + 60) * 0.3; // escala visual: −100…−20 dBFS → faixa do gráfico
  };

  const clipping = Date.now() - clipFlash < 400;
  const apo = toEqualizerAPO(filters, preamp);

  const overlay = (sc: PlotScales) => (
    <g>
      {filters.map((flt, i) =>
        flt.enabled === false ? null : (
          <circle
            key={flt.id}
            cx={sc.x(flt.freq)}
            cy={sc.y(Math.max(-15, Math.min(15, flt.type === 'peaking' || flt.type.endsWith('shelf') ? biquadDb(biquadCoefs(flt, 48000), flt.freq, 48000) : 0)))}
            r={7}
            fill={FILTER_COLORS[i % FILTER_COLORS.length]}
            stroke="var(--bg-elev)"
            strokeWidth={2}
            className="cursor-move"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              drag.current = flt.id;
            }}
            onPointerMove={(e) => {
              if (drag.current !== flt.id) return;
              const r = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
              const fr = Math.max(20, Math.min(20000, sc.fAt(e.clientX - r.left)));
              const g = Math.max(-15, Math.min(15, sc.dbAt(e.clientY - r.top)));
              setFilters((fs) => fs.map((x) => (x.id === flt.id ? { ...x, freq: Math.round(fr), gain: x.type === 'peaking' || x.type.endsWith('shelf') ? Math.round(g * 10) / 10 : x.gain } : x)));
            }}
            onPointerUp={() => (drag.current = null)}
          />
        ),
      )}
    </g>
  );

  return (
    <LabFrame
      title={tr("Equalizador paramétrico")}
      description={tr("Um EQ paramétrico real, aplicado ao áudio no seu navegador. Arraste os pontos coloridos no gráfico (frequência e ganho) ou ajuste cada filtro abaixo. Abra um arquivo seu para testar — nada é enviado a servidores.")}
      audio
      onReset={() => {
        setFilters(INITIAL);
        setEnabled(true);
        setAutoPre(true);
      }}
      toolbar={
        <motion.span
          animate={{ opacity: clipping ? 1 : 0.35, scale: clipping ? 1.05 : 1 }}
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${clipping ? 'bg-[var(--myth)] text-white' : 'bg-sunken text-faint'}`}
          aria-live="polite"
        >
          {clipping ? 'CLIPPING' : tr("sem clipping")}
        </motion.span>
      }
      footer={tr("Filtros biquad da Web Audio API (as mesmas fórmulas do gráfico). O teto digital simula a conversão final em ponto fixo: qualquer amostra acima de 0 dBFS é cortada, como num DAC real. As curvas tracejadas mostram o espectro ao vivo antes e depois da EQ.")}
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => setFilters(p.filters.map((f) => newFilter(f)))} className="text-[12.5px] px-2.5 py-1 rounded-lg border border-line text-muted hover:text-fg hover:border-line-strong transition-colors">
            {p.name}
          </button>
        ))}
      </div>
      <FreqPlot
        height={300}
        dbMin={-15}
        dbMax={15}
        dbStep={3}
        curves={[
          ...(taps ? [{ id: 'pre', fn: specFn('pre'), color: 'var(--fg-faint)', width: 1, opacity: 0.6, instant: true }, { id: 'post', fn: specFn('post'), color: 'var(--c-b)', width: 1, opacity: 0.7, instant: true }] : []),
          ...filters.map((flt, i) => ({ id: flt.id, fn: (f: number) => (flt.enabled === false ? 0 : biquadDb(biquadCoefs(flt, 48000), f, 48000)), color: FILTER_COLORS[i % FILTER_COLORS.length], width: 1, opacity: 0.6, instant: drag.current != null })),
          { id: 'total', label: tr("Curva total da EQ"), fn: total, color: 'var(--c-a)', width: 2.8, instant: drag.current != null },
        ]}
        overlay={overlay}
        ariaLabel={tr("Resposta do equalizador")}
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: tr("Curva total"), color: 'var(--c-a)' }, ...(taps ? [{ label: tr("Espectro antes (ao vivo)"), color: 'var(--fg-faint)' }, { label: tr("Espectro depois"), color: 'var(--c-b)' }] : [])]} />
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <FilterEditor filters={filters} onChange={setFilters} max={10} />
        <div className="space-y-4">
          <div>
            <Toggle checked={autoPre} onChange={setAutoPre} label={tr("Preamp automático")} />
            <div className="mt-2">
              <Slider label={tr("Preamp")} value={preamp} min={-15} max={6} step={0.1} onChange={(v) => { setAutoPre(false); setManualPre(v); }} format={fmtDb} hint={tr("Maior reforço da curva: {0}", fmtDb(maxBoost))} />
            </div>
          </div>
          <Toggle checked={hardClip} onChange={setHardClip} label={tr("Simular teto digital de 0 dBFS")} />
          <Readout
            items={[
              { label: tr("Maior reforço"), value: fmtDb(maxBoost), accent: maxBoost > 0 },
              { label: tr("Preamp aplicado"), value: fmtDb(preamp) },
              { label: tr("Filtros ativos"), value: fmtNum(filters.filter((f) => f.enabled !== false).length, 0) },
            ]}
          />
          <div>
            <div className="text-[12.5px] text-muted font-medium mb-1.5">{tr("Exportar (Equalizer APO / Peace)")}</div>
            <pre className="text-[11.5px] font-mono bg-sunken border border-line rounded-xl px-3 py-2.5 overflow-x-auto leading-relaxed max-h-[160px]">{apo}</pre>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1"
              icon={<IconCopy size={14} />}
              onClick={() => void navigator.clipboard?.writeText(apo).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            >
              {copied ? tr("Copiado") : tr("Copiar")}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-line">
        <SourceBar player={player} extra={<Toggle checked={enabled} onChange={setEnabled} label={enabled ? tr("EQ ligada") : tr("EQ desligada")} />} />
      </div>
      <div className="mt-3">
        <Note>{tr("Desligue o preamp automático e coloque um shelf de +8 dB nos graves com música alta: o indicador de clipping acende e você ouve a distorção. É o motivo de todo EQ que reforça precisar de um preamp negativo do mesmo tamanho do maior reforço. A comparação EQ ligada/desligada usa o mesmo preamp nos dois lados, para não confundir “melhor” com “mais alto”.")}</Note>
      </div>
    </LabFrame>
  );
}
