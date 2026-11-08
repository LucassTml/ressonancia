import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { FreqPlot } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb } from '../../audio/dsp';
import { tr } from '../../i18n';

const C = 343;

/** Ressonância representada como um pico de 2ª ordem: altura cresce com o Q. */
const reson = (f: number, f0: number, q: number, depth: number) =>
  f0 > 22000 ? 0 : biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: f0, gain: depth * 0.6 * 20 * Math.log10(q), q }, 96000), f, 96000);

export default function TubeLab() {
  const [mode, setMode] = useState<'tube' | 'helmholtz'>('tube');
  const [len, setLen] = useState(18);
  const [ends, setEnds] = useState<'open-closed' | 'closed-closed'>('closed-closed');
  const [damp, setDamp] = useState(0.3);
  const [vol, setVol] = useState(60);
  const [neckL, setNeckL] = useState(2);
  const [neckD, setNeckD] = useState(1.2);

  const tube = useMemo(() => {
    const L = len / 1000;
    const modes = Array.from({ length: 4 }, (_, k) => (ends === 'open-closed' ? ((2 * k + 1) * C) / (4 * L) : ((k + 1) * C) / (2 * L)));
    const q = 2 + (1 - damp) * 14; // amortecimento reduz o Q
    const fn = (f: number) => modes.reduce((acc, m) => acc + reson(f, m, q, 1), 0);
    return { modes, fn, q };
  }, [len, ends, damp]);

  const helm = useMemo(() => {
    const r = neckD / 2000;
    const A = Math.PI * r * r;
    const V = vol * 1e-9; // mm³ → m³
    const Leff = neckL / 1000 + 1.7 * r;
    const f0 = (C / (2 * Math.PI)) * Math.sqrt(A / (V * Leff));
    const q = 2 + (1 - damp) * 10;
    return { f0, fn: (f: number) => reson(f, f0, q, 1), q, Leff };
  }, [vol, neckL, neckD, damp]);

  const fn = mode === 'tube' ? tube.fn : helm.fn;

  return (
    <LabFrame
      title={tr("Tubos e ressonadores")}
      description={tr("Dentro de um IEM, o som passa por tubos, bocais e pequenas câmaras. Cada um ressoa em frequências definidas pela geometria — e um amortecedor acústico (damper) controla o quanto.")}
      onReset={() => {
        setLen(18);
        setEnds('closed-closed');
        setDamp(0.3);
        setVol(60);
        setNeckL(2);
        setNeckD(1.2);
      }}
      toolbar={
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'tube', label: tr("Tubo") },
            { value: 'helmholtz', label: tr("Helmholtz") },
          ]}
        />
      }
      footer={tr("Ressonâncias representadas como filtros de 2ª ordem somados, para visualizar posição e intensidade. A correção de extremidade do gargalo usa ≈1,7·raio (valor típico para aberturas flangeadas nas duas pontas).")}
    >
      <FreqPlot height={250} dbMin={-6} dbMax={24} dbStep={6} fMin={200} curves={[{ id: 'r', label: tr("Efeito da ressonância"), fn, color: 'var(--c-a)', width: 2.4, fill: true }]} ariaLabel={tr("Ressonâncias acústicas")} />
      <div className="mt-4">
        {mode === 'tube' ? (
          <>
            <div className="mb-4">
              <Segmented
                size="sm"
                value={ends}
                onChange={setEnds}
                options={[
                  { value: 'closed-closed', label: tr("Fechado nas duas pontas (½ onda)") },
                  { value: 'open-closed', label: tr("Aberto numa ponta (¼ de onda)") },
                ]}
              />
            </div>
            <Controls cols={2}>
              <Slider label={tr("Comprimento")} value={len} min={4} max={40} step={0.5} onChange={setLen} unit="mm" />
              <Slider label={tr("Amortecimento (damper)")} value={damp} min={0} max={1} step={0.01} onChange={setDamp} format={(v) => `${Math.round(v * 100)}%`} />
            </Controls>
            <div className="mt-4">
              <Readout
                items={tube.modes.slice(0, 3).map((m, i) => ({ label: tr("{0}º modo", i + 1), value: fmtHz(m), accent: i === 0 }))}
              />
            </div>
          </>
        ) : (
          <>
            <Controls cols={3}>
              <Slider label={tr("Volume da câmara")} value={vol} min={10} max={400} log onChange={(v) => setVol(Math.round(v))} unit={tr("mm³")} />
              <Slider label={tr("Comprimento do gargalo")} value={neckL} min={0.5} max={10} step={0.1} onChange={setNeckL} unit="mm" />
              <Slider label={tr("Diâmetro do gargalo")} value={neckD} min={0.3} max={3} step={0.05} onChange={setNeckD} unit="mm" />
              <Slider label={tr("Amortecimento")} value={damp} min={0} max={1} step={0.01} onChange={setDamp} format={(v) => `${Math.round(v * 100)}%`} />
            </Controls>
            <div className="mt-4">
              <Readout
                items={[
                  { label: 'f₀ = (c/2π)·√(A/(V·L))', value: fmtHz(helm.f0), accent: true },
                  { label: tr("Comprimento efetivo do gargalo"), value: `${fmtNum(helm.Leff * 1000, 2)} mm` },
                  { label: tr("Q aproximado"), value: fmtNum(helm.q, 1) },
                ]}
              />
            </div>
          </>
        )}
      </div>
      <div className="mt-3">
        <Note>
          {mode === 'tube'
            ? tr("Num IEM com BA, o tubo entre o driver e o bocal costuma ter de 5 a 20 mm: suas ressonâncias caem justamente entre 4 e 20 kHz. Engenheiros escolhem comprimentos e diâmetros para posicioná-las onde ajudam (por exemplo, recriando o ganho de presença) e usam dampers para domar as que atrapalham.")
            : tr("Uma câmara pequena com uma abertura estreita vira um ressonador de Helmholtz: a massa de ar no gargalo oscila contra a “mola” do ar na câmara. Ventilações e câmaras auxiliares em IEMs com drivers dinâmicos usam esse princípio para ajustar graves e médios-graves.")}
        </Note>
      </div>
    </LabFrame>
  );
}
