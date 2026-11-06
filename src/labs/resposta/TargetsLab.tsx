import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtDb, fmtNum } from '../../components/ui/controls';
import { FreqPlot, Legend, type PlotCurve } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, interpCurve } from '../../audio/dsp';
import { harmanIE, harmanIENoBass, rigLabel, targetById, targets } from '../../data/targets';

const COLORS: Record<string, string> = {
  'harman-ie-2019': 'var(--c-a)',
  'harman-ie-2019-nobass': 'var(--c-target)',
  'harman-ie-2017': 'var(--c-b)',
  'harman-ie-2016': '#8fa3f5',
  'harman-oe-2018': '#e8795f',
  'df-5128': 'var(--c-diff)',
  'df-iso11904': '#6fd39a',
};

export default function TargetsLab() {
  const [mode, setMode] = useState<'compare' | 'build'>('compare');
  const [shown, setShown] = useState<string[]>(['harman-ie-2019', 'harman-ie-2019-nobass', 'harman-ie-2017']);
  const [bass, setBass] = useState(100);
  const [tilt, setTilt] = useState(0);
  const [norm, setNorm] = useState(1000);

  const toggle = (id: string) => setShown((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Harman IE como "sem grave" + fração do shelf de grave + inclinação de agudos
  const built = useMemo(() => {
    const tiltF = biquadCoefs({ id: 't', type: 'highshelf', freq: 1500, gain: tilt, q: 0.5 }, 48000);
    return (f: number) => {
      const shelf = interpCurve(harmanIE.curve, f) - interpCurve(harmanIENoBass.curve, f);
      return interpCurve(harmanIENoBass.curve, f) + (bass / 100) * shelf + (tilt ? biquadDb(tiltF, f, 48000) : 0);
    };
  }, [bass, tilt]);

  const normOff = (fn: (f: number) => number) => (f: number) => fn(f) - fn(norm);

  const curves: PlotCurve[] =
    mode === 'compare'
      ? shown.map((id) => ({
          id,
          label: targetById[id].short,
          fn: normOff((f) => interpCurve(targetById[id].curve, f)),
          color: COLORS[id],
          width: id === 'harman-ie-2019' ? 2.4 : 1.6,
          dash: targetById[id].rig !== '711' ? '5 4' : undefined,
        }))
      : [
          { id: 'ref', label: 'Harman IE 2019', fn: (f) => interpCurve(harmanIE.curve, f), color: 'var(--c-target)', width: 1.4, dash: '5 4' },
          { id: 'built', label: 'Sua variação', fn: built, color: 'var(--c-a)', width: 2.6 },
        ];

  const shelfAt20 = interpCurve(harmanIE.curve, 20) - interpCurve(harmanIENoBass.curve, 20);

  return (
    <LabFrame
      title="Curvas-alvo lado a lado"
      description="Dados das curvas publicadas (via projeto AutoEq). Compare versões e referências, ou construa variações do alvo Harman ajustando o shelf de graves e a inclinação de agudos — os dois parâmetros em que as preferências mais variam."
      onReset={() => {
        setShown(['harman-ie-2019', 'harman-ie-2019-nobass', 'harman-ie-2017']);
        setBass(100);
        setTilt(0);
        setNorm(1000);
      }}
      toolbar={
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'compare', label: 'Comparar alvos' },
            { value: 'build', label: 'Variar o Harman' },
          ]}
        />
      }
      footer="Linhas tracejadas usam outro equipamento de referência (5128, tímpano ou cabeça com orelha) e não devem ser comparadas ponto a ponto com curvas em acoplador 711 — as diferenças acima de ~1 kHz refletem os equipamentos, não apenas os alvos."
    >
      {mode === 'compare' && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              title={t.description}
              className={`text-[12.5px] px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                shown.includes(t.id) ? 'border-line-strong text-fg bg-sunken' : 'border-line text-muted hover:text-fg'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: shown.includes(t.id) ? COLORS[t.id] : 'var(--line-strong)' }} />
              {t.short}
            </button>
          ))}
        </div>
      )}
      <FreqPlot curves={curves} height={320} dbMin={-12} dbMax={18} dbStep={3} ariaLabel="Curvas-alvo" />
      <div className="mt-2 mb-4">
        <Legend items={curves.map((c) => ({ label: c.label!, color: c.color, dash: !!c.dash }))} />
      </div>
      {mode === 'compare' ? (
        <>
          <Controls cols={2}>
            <Slider label="Normalizar em" value={norm} min={200} max={2000} log onChange={(v) => setNorm(Math.round(v))} unit="Hz" hint="A escolha do ponto de normalização desloca curvas inteiras para cima ou para baixo." />
          </Controls>
          <div className="mt-4 space-y-2">
            {shown.map((id) => (
              <p key={id} className="text-[13px] leading-relaxed text-soft">
                <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: COLORS[id] }} />
                <strong className="text-fg font-medium">{targetById[id].name}</strong> <span className="text-faint">— {rigLabel[targetById[id].rig]}.</span>{' '}
                {targetById[id].description}
              </p>
            ))}
          </div>
        </>
      ) : (
        <>
          <Controls cols={2}>
            <Slider label="Quantidade do shelf de graves" value={bass} min={0} max={200} step={5} onChange={setBass} unit="%" hint={`100% = shelf original (~${fmtNum(shelfAt20, 1)} dB em 20 Hz)`} />
            <Slider label="Inclinação de agudos (acima de ~1,5 kHz)" value={tilt} min={-6} max={6} step={0.5} onChange={setTilt} format={fmtDb} />
          </Controls>
          <div className="mt-4">
            <Readout
              items={[
                { label: 'Graves em 30 Hz', value: fmtDb(built(30)), accent: true },
                { label: 'Pico de presença (≈3 kHz)', value: fmtDb(built(3000)) },
                { label: 'Em 10 kHz', value: fmtDb(built(10000)) },
              ]}
            />
          </div>
          <div className="mt-3">
            <Note>
              Os estudos da Harman encontraram ouvintes que preferem, em média, o shelf original; outros, mais ou menos graves; e preferências de
              agudos que variam com a idade e a experiência. Estas duas alavancas cobrem a maior parte dessa variação. Para encontrar os seus
              valores, use o laboratório “Sua curva de preferência”.
            </Note>
          </div>
        </>
      )}
    </LabFrame>
  );
}
