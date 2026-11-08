import { useMemo, useState } from 'react';
import { LabFrame, Controls, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtHz } from '../../components/ui/controls';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, interpCurve, logFreqs, smoothCurve, type Curve } from '../../audio/dsp';
import { harmanIE } from '../../data/targets';
import { tr } from '../../i18n';

const FS = 96000;
const pk = (f: number, fc: number, g: number, q: number) => biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: fc, gain: g, q }, FS), f, FS);

/** Uma "medição bruta" sintética com detalhes finos realistas (ressonâncias, ondulações). */
function rawMeasurement(depth: number, seed: number): Curve {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  const ripple = Array.from({ length: 40 }, () => rnd());
  const fOcc = 343 / (2 * ((25 - depth + 4) / 1000));
  return logFreqs(720).map((f) => {
    const lf = Math.log2(f / 20);
    const r = ripple[Math.floor(lf * 4) % 40] * (f > 4000 ? 1.6 : 0.4) * Math.sin(lf * 25);
    const d =
      interpCurve(harmanIE.curve, f) +
      pk(f, 60, 1.5, 0.8) +
      pk(f, 1700, -1.5, 1.2) +
      pk(f, fOcc, 6, 4) +
      pk(f, fOcc * 1.45, -7, 5) +
      pk(f, 13500, 4, 3) +
      r;
    return [f, d];
  });
}

const D = { smooth: '24', norm: 1000, depth: 8, range: 'normal' as 'tight' | 'normal' | 'wide', unit2: false, view: 'one' as 'one' | 'two' };

export default function RigCompareLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));

  const make = (depth: number, seed: number) => {
    let c = rawMeasurement(depth, seed);
    if (s.smooth !== 'none') c = smoothCurve(c, Number(s.smooth));
    const off = interpCurve(c, s.norm);
    return c.map(([f, d]) => [f, d - off] as [number, number]);
  };
  const c1 = useMemo(() => make(s.depth, 7), [s.smooth, s.norm, s.depth]); // eslint-disable-line react-hooks/exhaustive-deps
  const c2 = useMemo(() => make(s.depth + 2.5, 11), [s.smooth, s.norm, s.depth]); // eslint-disable-line react-hooks/exhaustive-deps
  const c1b = useMemo(() => {
    // "outra fonte": suavização 1/3, normalização em 500 Hz e inserção mais rasa
    let c = smoothCurve(rawMeasurement(s.depth - 3, 7), 3);
    const off = interpCurve(c, 500);
    c = c.map(([f, d]) => [f, d - off]);
    return c;
  }, [s.depth]);

  const ranges = { tight: [-6, 14, 2], normal: [-12, 18, 3], wide: [-40, 40, 10] } as const;
  const [dbMin, dbMax, step] = ranges[s.range];

  return (
    <LabFrame
      title={tr("O mesmo fone, gráficos diferentes")}
      description={tr("Uma medição sintética com detalhes realistas. Mude a suavização, o ponto de normalização, a profundidade de inserção no acoplador e a escala do eixo: o fone é o mesmo, mas a leitura do gráfico muda bastante.")}
      onReset={() => setS(D)}
      toolbar={
        <Segmented
          size="sm"
          value={s.view}
          onChange={(v) => set('view', v)}
          options={[
            { value: 'one', label: tr("Um gráfico") },
            { value: 'two', label: tr("Duas fontes") },
          ]}
        />
      }
      footer={tr("Curvas sintéticas para fins didáticos. Em medições reais, a variação entre equipamentos, posicionamentos e unidades costuma ter exatamente essa ordem de grandeza — às vezes maior.")}
    >
      <FreqPlot
        height={310}
        dbMin={dbMin}
        dbMax={dbMax}
        dbStep={step}
        curves={[
          { id: 'c1', label: s.view === 'two' ? tr("Fonte A (seus ajustes)") : tr("Unidade 1"), fn: (f) => interpCurve(c1, f), color: 'var(--c-a)', width: 2 },
          ...(s.unit2 && s.view === 'one' ? [{ id: 'c2', label: tr("Unidade 2"), fn: (f: number) => interpCurve(c2, f), color: 'var(--c-b)', width: 1.6 }] : []),
          ...(s.view === 'two' ? [{ id: 'c1b', label: tr("Fonte B (1/3 oit., norm. 500 Hz, inserção rasa)"), fn: (f: number) => interpCurve(c1b, f), color: 'var(--c-target)', width: 2 }] : []),
        ]}
        ariaLabel={tr("Medição de um fone com diferentes apresentações")}
      />
      <div className="mt-2 mb-4">
        <Legend
          items={[
            { label: s.view === 'two' ? tr("Fonte A") : tr("Unidade 1"), color: 'var(--c-a)' },
            ...(s.unit2 && s.view === 'one' ? [{ label: tr("Unidade 2 (inserção +2,5 mm)"), color: 'var(--c-b)' }] : []),
            ...(s.view === 'two' ? [{ label: tr("Fonte B: mesmo fone, outros critérios"), color: 'var(--c-target)' }] : []),
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Segmented
          size="sm"
          label={tr("Suavização")}
          value={s.smooth}
          onChange={(v) => set('smooth', v)}
          options={[
            { value: 'none', label: tr("Sem suavização") },
            { value: '24', label: tr("1/24 oit.") },
            { value: '12', label: '1/12' },
            { value: '6', label: '1/6' },
            { value: '3', label: '1/3' },
          ]}
        />
        <Segmented
          size="sm"
          label={tr("Escala")}
          value={s.range}
          onChange={(v) => set('range', v)}
          options={[
            { value: 'tight', label: tr("Eixo apertado") },
            { value: 'normal', label: tr("Eixo normal") },
            { value: 'wide', label: tr("Eixo ±40 dB") },
          ]}
        />
        {s.view === 'one' && <Toggle checked={s.unit2} onChange={(v) => set('unit2', v)} label={tr("Mostrar segunda medição")} />}
      </div>
      <Controls cols={2}>
        <Slider label={tr("Normalização")} value={s.norm} min={200} max={3000} log onChange={(v) => set('norm', Math.round(v))} format={fmtHz} hint={tr("Frequência forçada a 0 dB.")} />
        <Slider label={tr("Profundidade no acoplador")} value={s.depth} min={4} max={13} step={0.5} onChange={(v) => set('depth', v)} unit="mm" hint={tr("Desloca a ressonância de 7–10 kHz.")} />
      </Controls>
      <div className="mt-3">
        <Note>{tr("Observe: (1) a suavização de 1/3 de oitava apaga o pico estreito perto de 13 kHz e arredonda a ressonância; (2) normalizar em 2 kHz faz os graves “caírem” vários dB; (3) com o eixo de ±40 dB tudo parece plano, com o eixo apertado tudo parece um desastre; (4) dois posicionamentos do mesmo fone diferem vários dB acima de 6 kHz.")}</Note>
      </div>
    </LabFrame>
  );
}
