import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { Cap, L, PHONES, R, cabs, cadd } from '../../audio/impedance';

const ohm = (db: number) => {
  const v = Math.pow(10, db / 20);
  return v >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, v < 10 ? 1 : 0);
};
const toDb = (z: number) => 20 * Math.log10(Math.max(1e-3, z));

export default function ImpedanceLab() {
  const [tab, setTab] = useState<'parts' | 'phones'>('phones');
  const [r, setR] = useState(16);
  const [l, setL] = useState(1);
  const [c, setC] = useState(10);
  const [shown, setShown] = useState<string[]>(['dd', 'ba', 'multi']);
  const [probe, setProbe] = useState(1000);

  const parts = useMemo(
    () => ({
      r: () => toDb(r),
      xl: (f: number) => toDb(cabs(L(l * 1e-3, f))),
      xc: (f: number) => toDb(cabs(Cap(c * 1e-6, f))),
      series: (f: number) => toDb(cabs(cadd(cadd(R(r), L(l * 1e-3, f)), Cap(c * 1e-6, f)))),
    }),
    [r, l, c],
  );
  const f0 = 1 / (2 * Math.PI * Math.sqrt(l * 1e-3 * c * 1e-6));
  const colors = ['var(--c-a)', 'var(--c-b)', 'var(--c-target)', 'var(--c-diff)', '#6fd39a'];

  return (
    <LabFrame
      title="Impedância em função da frequência"
      description="Resistores dissipam energia igualmente em qualquer frequência; indutores e capacitores armazenam e devolvem energia, e sua oposição à corrente (reatância) muda com a frequência. Fones combinam os três."
      onReset={() => {
        setR(16);
        setL(1);
        setC(10);
        setShown(['dd', 'ba', 'multi']);
      }}
      toolbar={
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'phones', label: 'Fones' },
            { value: 'parts', label: 'R, L e C' },
          ]}
        />
      }
      footer="Modelos elétricos representativos (não correspondem a produtos específicos). A escala vertical é logarítmica em ohms."
    >
      {tab === 'phones' ? (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PHONES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setShown((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                className={`text-[12.5px] px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 transition-colors ${shown.includes(p.id) ? 'border-line-strong text-fg bg-sunken' : 'border-line text-muted'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: shown.includes(p.id) ? colors[i] : 'var(--line-strong)' }} />
                {p.name}
              </button>
            ))}
          </div>
          <FreqPlot
            height={280}
            dbMin={10}
            dbMax={60}
            dbStep={10}
            yLabel="Ω"
            yFormat={ohm}
            curves={PHONES.map((p, i) => ({ p, i })).filter(({ p }) => shown.includes(p.id)).map(({ p, i }) => ({ id: p.id, label: p.name, fn: (f: number) => toDb(cabs(p.z(f))), color: colors[i], width: 2 }))}
            overlay={(sc) => <line x1={sc.x(probe)} x2={sc.x(probe)} y1={sc.top} y2={sc.top + sc.innerH} stroke="var(--fg-faint)" strokeDasharray="3 3" />}
            ariaLabel="Curvas de impedância de fones"
          />
          <div className="mt-4">
            <Controls cols={2}>
              <Slider label="Frequência de leitura" value={probe} min={20} max={20000} log onChange={(v) => setProbe(Math.round(v))} format={fmtHz} />
            </Controls>
          </div>
          <div className="mt-4">
            <Readout items={PHONES.filter((p) => shown.includes(p.id)).map((p) => ({ label: `${p.name} (nominal ${p.nominal} Ω)`, value: `${fmtNum(cabs(p.z(probe)), 1)} Ω` }))} />
          </div>
          <div className="mt-3 space-y-1">
            {PHONES.filter((p) => shown.includes(p.id)).map((p) => (
              <p key={p.id} className="text-[12.5px] text-muted leading-relaxed">
                <strong className="text-soft font-medium">{p.name}:</strong> {p.note}
              </p>
            ))}
          </div>
        </>
      ) : (
        <>
          <FreqPlot
            height={280}
            dbMin={0}
            dbMax={80}
            dbStep={20}
            yLabel="Ω"
            yFormat={ohm}
            curves={[
              { id: 'r', label: `Resistor ${r} Ω`, fn: parts.r, color: 'var(--fg-muted)', width: 1.5 },
              { id: 'xl', label: `Indutor ${l} mH`, fn: parts.xl, color: 'var(--c-b)', width: 1.8 },
              { id: 'xc', label: `Capacitor ${c} µF`, fn: parts.xc, color: 'var(--c-target)', width: 1.8 },
              { id: 's', label: 'R + L + C em série', fn: parts.series, color: 'var(--c-a)', width: 2.6 },
            ]}
            ariaLabel="Reatâncias de componentes"
          />
          <div className="mt-2 mb-4">
            <Legend items={[{ label: 'R', color: 'var(--fg-muted)' }, { label: 'X_L = 2πfL', color: 'var(--c-b)' }, { label: 'X_C = 1/(2πfC)', color: 'var(--c-target)' }, { label: 'Série RLC', color: 'var(--c-a)' }]} />
          </div>
          <Controls cols={3}>
            <Slider label="Resistência" value={r} min={1} max={300} log onChange={(v) => setR(Math.round(v))} unit="Ω" />
            <Slider label="Indutância" value={l} min={0.01} max={10} log onChange={(v) => setL(Number(v.toPrecision(2)))} unit="mH" />
            <Slider label="Capacitância" value={c} min={0.1} max={1000} log onChange={(v) => setC(Number(v.toPrecision(2)))} unit="µF" />
          </Controls>
          <div className="mt-4">
            <Readout
              items={[
                { label: 'Ressonância série  f = 1/(2π√LC)', value: fmtHz(f0), accent: true },
                { label: 'Impedância mínima (= R)', value: `${r} Ω` },
              ]}
            />
          </div>
          <div className="mt-3">
            <Note>
              A reatância do indutor cresce com a frequência (ele “resiste” a variações rápidas de corrente); a do capacitor diminui (ele deixa
              passar variações rápidas e bloqueia a corrente contínua). Por isso um capacitor em série com um tweeter é o crossover passa-altas
              mais simples que existe.
            </Note>
          </div>
        </>
      )}
    </LabFrame>
  );
}
