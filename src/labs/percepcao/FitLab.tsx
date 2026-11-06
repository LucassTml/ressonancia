import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtHz, fmtNum } from '../../components/ui/controls';
import { SourceBar, useSourcePlayer } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, firBuffer, interpCurve } from '../../audio/dsp';
import { harmanIE } from '../../data/targets';

const FS = 96000;
const C = 343;
const pk = (f: number, fc: number, g: number, q: number) => biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: fc, gain: g, q }, FS), f, FS);
const hs = (f: number, fc: number, g: number) => biquadDb(biquadCoefs({ id: '', type: 'highshelf', freq: fc, gain: g, q: 0.707 }, FS), f, FS);
const fOcc = (insertion: number, canal = 25) => C / (2 * ((canal - insertion + 4) / 1000));

const D = { leak: 0, insertion: 8, tip: 'silicone' as 'silicone' | 'foam', bore: 'standard' as 'narrow' | 'standard' | 'wide', hear: true };

/** Variação (dB) da resposta no tímpano causada por encaixe, inserção e ponteira — modelo didático. */
export function fitDelta(p: typeof D) {
  const fl = 10 * Math.pow(40, p.leak); // canto do "vazamento" (passa-altas de 1ª ordem)
  const f0 = fOcc(8), f1 = fOcc(p.insertion);
  return (f: number) => {
    let d = p.leak > 0.001 ? 10 * Math.log10((f * f) / (f * f + fl * fl)) : 0;
    // vazamento leve também cria uma pequena elevação logo acima do canto
    d += p.leak > 0.05 ? pk(f, fl * 2.2, 1.5 * Math.min(1, p.leak * 3), 1.2) : 0;
    d += pk(f, f1, 8, 3) - pk(f, f0, 8, 3);
    if (p.tip === 'foam') d += hs(f, 5000, -3) + (p.leak < 0.2 ? pk(f, 40, 1, 0.5) : 0);
    if (p.bore === 'narrow') d += hs(f, 4500, -2.5) + pk(f, 3000, 1, 1);
    if (p.bore === 'wide') d += hs(f, 5000, 1.5);
    return d;
  };
}

export default function FitLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const delta = useMemo(() => fitDelta(s), [s]);
  const base = (f: number) => interpCurve(harmanIE.curve, f);

  const convRef = useRef<ConvolverNode | null>(null);
  const bypassRef = useRef<{ dry: GainNode; wet: GainNode } | null>(null);
  const player = useSourcePlayer('fit', (ctx, input, output) => {
    const conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = firBuffer(ctx, delta);
    const dry = ctx.createGain(), wet = ctx.createGain();
    dry.gain.value = s.hear ? 0 : 1;
    wet.gain.value = s.hear ? 1 : 0;
    input.connect(dry).connect(output);
    input.connect(conv).connect(wet).connect(output);
    convRef.current = conv;
    bypassRef.current = { dry, wet };
    return () => {
      convRef.current = null;
      bypassRef.current = null;
    };
  });
  useEffect(() => {
    if (convRef.current) convRef.current.buffer = firBuffer(convRef.current.context, delta);
  }, [delta]);
  useEffect(() => {
    const b = bypassRef.current;
    if (!b) return;
    const t = b.dry.context.currentTime;
    b.dry.gain.setTargetAtTime(s.hear ? 0 : 1, t, 0.02);
    b.wet.gain.setTargetAtTime(s.hear ? 1 : 0, t, 0.02);
  }, [s.hear]);

  const fl = 10 * Math.pow(40, s.leak);
  return (
    <LabFrame
      title="Simulador de encaixe"
      description="Um IEM hipotético afinado exatamente no alvo Harman IE 2019, e o que acontece com a resposta no seu tímpano quando a vedação, a profundidade ou a ponteira mudam."
      audio
      onReset={() => setS(D)}
      footer="Modelo didático com ordens de grandeza realistas: o vazamento é tratado como um passa-altas de 1ª ordem, a profundidade desloca a ressonância de meia onda do canal residual, e materiais/furos aplicam variações típicas relatadas em medições. Cada combinação real de IEM, ponteira e orelha é diferente."
    >
      <FreqPlot
        height={280}
        dbMin={-24}
        dbMax={16}
        dbStep={6}
        curves={[
          { id: 'ref', label: 'Encaixe de referência', fn: base, color: 'var(--c-target)', width: 1.6, dash: '5 4' },
          { id: 'now', label: 'Com este encaixe', fn: (f) => base(f) + delta(f), color: 'var(--c-a)', width: 2.4 },
          { id: 'diff', label: 'Diferença', fn: delta, color: 'var(--c-diff)', width: 1.3, opacity: 0.8 },
        ]}
        ariaLabel="Resposta do IEM com diferentes encaixes"
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: 'Referência (alvo)', color: 'var(--c-target)', dash: true }, { label: 'Com este encaixe', color: 'var(--c-a)' }, { label: 'Diferença', color: 'var(--c-diff)' }]} />
      </div>
      <Controls cols={2}>
        <Slider
          label="Vazamento da vedação"
          value={s.leak}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set('leak', v)}
          format={(v) => (v < 0.02 ? 'vedado' : v < 0.35 ? 'leve' : v < 0.7 ? 'moderado' : 'grande')}
          hint={s.leak > 0.02 ? `Perda de −3 dB por volta de ${fmtHz(fl)}` : 'Vedação perfeita'}
        />
        <Slider label="Profundidade de inserção" value={s.insertion} min={3} max={14} step={0.5} onChange={(v) => set('insertion', v)} unit="mm" hint={`Ressonância do canal residual ≈ ${fmtHz(fOcc(s.insertion))}`} />
      </Controls>
      <div className="flex flex-wrap gap-3 mt-4">
        <Segmented size="sm" label="Material" value={s.tip} onChange={(v) => set('tip', v)} options={[{ value: 'silicone', label: 'Silicone' }, { value: 'foam', label: 'Espuma' }]} />
        <Segmented size="sm" label="Furo" value={s.bore} onChange={(v) => set('bore', v)} options={[{ value: 'narrow', label: 'Furo estreito' }, { value: 'standard', label: 'Furo padrão' }, { value: 'wide', label: 'Furo largo' }]} />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Variação em 30 Hz', value: `${fmtNum(delta(30), 1)} dB`, accent: true },
            { label: 'Variação em 100 Hz', value: `${fmtNum(delta(100), 1)} dB` },
            { label: 'Variação em 8 kHz', value: `${fmtNum(delta(8000), 1)} dB` },
          ]}
        />
      </div>
      <div className="mt-5">
        <SourceBar player={player} extra={<Toggle checked={s.hear} onChange={(v) => set('hear', v)} label="Aplicar efeito do encaixe" />} />
      </div>
      <div className="mt-3">
        <Note>
          Um vazamento pequeno, que você mal sente, já tira vários decibéis do subgrave. É a causa mais comum de alguém achar que um IEM
          “não tem grave” — e um motivo para desconfiar de impressões feitas com a ponteira errada.
        </Note>
      </div>
    </LabFrame>
  );
}
