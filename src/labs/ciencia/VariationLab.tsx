import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Button, Slider, Toggle, fmtNum } from '../../components/ui/controls';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, interpCurve, logFreqs } from '../../audio/dsp';
import { harmanIE } from '../../data/targets';

const FS = 96000;
const pk = (f: number, fc: number, g: number, q: number) => biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: fc, gain: g, q }, FS), f, FS);

/** Gaussiana pelo método de Box-Muller com gerador semeado. */
function gauss(seed: number) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return () => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
}

export default function VariationLab() {
  const [n, setN] = useState(12);
  const [sigma, setSigma] = useState(1);
  const [seed, setSeed] = useState(3);
  const [showBand, setShowBand] = useState(true);
  const base = (f: number) => interpCurve(harmanIE.curve, f);

  const units = useMemo(() => {
    const g = gauss(seed * 7919);
    return Array.from({ length: n }, () => {
      // cada fonte de variação é independente: sensibilidade do BA, grave do DD, ressonâncias de tubo, posicionamento
      const ba = g() * sigma * 1.4, dd = g() * sigma * 0.8, tube = 1 + g() * sigma * 0.03, res = g() * sigma * 1.6, fit = g() * sigma * 1.2;
      return (f: number) => base(f) + pk(f, 3200, ba, 0.9) + pk(f, 80, dd, 0.5) + pk(f, 8000 * tube, res, 3) - pk(f, 8000, res * 0.7, 3) + pk(f, 11000, fit, 1.5);
    });
  }, [n, sigma, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const fs = logFreqs(90);
    const mean = fs.map((f) => units.reduce((s, u) => s + u(f), 0) / units.length);
    const sd = fs.map((f, i) => Math.sqrt(units.reduce((s, u) => s + (u(f) - mean[i]) ** 2, 0) / Math.max(1, units.length - 1)));
    const curve = (arr: number[]) => (f: number) => interpCurve(fs.map((x, i) => [x, arr[i]] as [number, number]), f);
    const maxDiff = Math.max(...fs.map((f) => Math.max(...units.map((u) => u(f))) - Math.min(...units.map((u) => u(f)))));
    const diff12 = Math.max(...fs.filter((f) => f < 10000).map((f) => Math.abs(units[0](f) - units[1](f))));
    return { mean: curve(mean), up: curve(mean.map((m, i) => m + sd[i])), dn: curve(mean.map((m, i) => m - sd[i])), maxDiff, diff12, sd3k: sd[fs.findIndex((f) => f >= 3000)], sd8k: sd[fs.findIndex((f) => f >= 8000)] };
  }, [units]);

  return (
    <LabFrame
      title="Variação entre unidades"
      description="Um lote de unidades do mesmo modelo de IEM, cada uma com pequenas variações independentes de componentes e montagem. Uma medição de review é uma amostra desse lote."
      onReset={() => {
        setN(12);
        setSigma(1);
        setSeed(3);
      }}
      footer="Simulação: variações gaussianas em sensibilidade de drivers, ressonâncias de tubos e encaixe no acoplador. As magnitudes padrão (desvio de ~1–2 dB em algumas regiões) são compatíveis com tolerâncias comuns de fabricação de BAs e com a repetibilidade de medições."
    >
      <FreqPlot
        height={290}
        dbMin={-9}
        dbMax={15}
        dbStep={3}
        readout={false}
        curves={[
          ...units.map((u, i) => ({ id: `u${i}`, fn: u, color: i === 0 ? 'var(--c-a)' : i === 1 ? 'var(--c-b)' : 'var(--fg-faint)', width: i < 2 ? 2 : 1, opacity: i < 2 ? 1 : 0.55 })),
          ...(showBand ? [{ id: 'up', fn: stats.up, color: 'var(--c-target)', width: 1.4, dash: '5 4' }, { id: 'dn', fn: stats.dn, color: 'var(--c-target)', width: 1.4, dash: '5 4' }] : []),
        ]}
        ariaLabel="Respostas de várias unidades do mesmo modelo"
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: 'Unidade do review', color: 'var(--c-a)' }, { label: 'Sua unidade', color: 'var(--c-b)' }, { label: 'Outras unidades', color: 'var(--fg-faint)' }, ...(showBand ? [{ label: 'Média ± 1 desvio padrão', color: 'var(--c-target)', dash: true }] : [])]} />
      </div>
      <Controls cols={2}>
        <Slider label="Unidades no lote" value={n} min={2} max={40} step={1} onChange={setN} />
        <Slider label="Escala das tolerâncias" value={sigma} min={0.2} max={2.5} step={0.05} onChange={setSigma} format={(v) => `${fmtNum(v, 2)}×`} />
      </Controls>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Button onClick={() => setSeed((s) => s + 1)}>Fabricar outro lote</Button>
        <Toggle checked={showBand} onChange={setShowBand} label="Mostrar faixa de ±1σ" />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Desvio padrão em 3 kHz', value: `${fmtNum(stats.sd3k, 2)} dB` },
            { label: 'Desvio padrão em 8 kHz', value: `${fmtNum(stats.sd8k, 2)} dB` },
            { label: 'Maior diferença “review × sua” (até 10 kHz)', value: `${fmtNum(stats.diff12, 1)} dB`, accent: true },
            { label: 'Maior dispersão no lote', value: `${fmtNum(stats.maxDiff, 1)} dB` },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>
          Conclusões sobre diferenças de 1–2 dB entre dois IEMs, baseadas em uma única unidade de cada, podem estar dentro da variação de
          produção. Quanto mais unidades medidas (e mais reposicionamentos), mais confiável a média — exatamente como em qualquer medição
          científica.
        </Note>
      </div>
    </LabFrame>
  );
}
