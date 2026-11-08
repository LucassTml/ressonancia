import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtDb, fmtNum } from '../../components/ui/controls';
import { FreqPlot } from '../../viz/FreqPlot';
import { PHONES, cabs, cadd, phoneById } from '../../audio/impedance';
import { tr } from '../../i18n';

export default function CableLab() {
  const [model, setModel] = useState('multi');
  const [rCond, setRCond] = useState(0.25);
  const [len, setLen] = useState(1.2);
  const [cap, setCap] = useState(100);
  const [wiring, setWiring] = useState<'se' | 'bal'>('se');
  const m = phoneById[model];

  // resistência total no caminho: ida + volta (em single-ended o retorno é compartilhado)
  const rLoop = rCond * 2;
  const dev = useMemo(() => {
    const g = (f: number) => 20 * Math.log10(cabs(m.z(f)) / cabs(cadd(m.z(f), [rLoop, 0])));
    const ref = g(1000);
    return (f: number) => g(f) - ref;
  }, [m, rLoop]);

  const zmin = Math.min(...[20, 100, 1000, 3000, 6000, 10000, 15000].map((f) => cabs(m.z(f))));
  const crosstalk = wiring === 'se' ? 20 * Math.log10(rCond / (zmin + rCond)) : -Infinity;
  const fc = 1 / (2 * Math.PI * 1 * (cap * 1e-12 * len));

  return (
    <LabFrame
      title={tr("O que um cabo faz eletricamente")}
      description={tr("Um cabo de fone é um par de condutores com resistência, capacitância e indutância. Calcule o que essas grandezas fazem com o sinal — e compare com o que se costuma atribuir a cabos.")}
      onReset={() => {
        setModel('multi');
        setRCond(0.25);
        setLen(1.2);
        setCap(100);
        setWiring('se');
      }}
      toolbar={<Segmented size="sm" value={model} onChange={setModel} options={PHONES.filter((p) => p.id !== 'hp300').map((p) => ({ value: p.id, label: p.name.replace('IEM ', '').replace(tr(" (3 vias, crossover passivo)"), '') }))} />}
      footer={tr("Modelo de parâmetros concentrados (válido em áudio, onde o comprimento de onda elétrico tem milhares de quilômetros). Resistências típicas: 0,1–0,5 Ω por condutor em cabos de IEM; capacitância de 50–150 pF/m.")}
    >
      <FreqPlot height={210} dbMin={-1.5} dbMax={0.5} dbStep={0.5} curves={[{ id: 'd', label: tr("Efeito do cabo"), fn: dev, color: 'var(--c-a)', width: 2.4 }]} yFormat={(v) => (v > 0 ? `+${v}` : `${v}`)} ariaLabel={tr("Efeito da resistência do cabo na resposta")} />
      <div className="mt-4">
        <Controls cols={3}>
          <Slider label={tr("Resistência por condutor")} value={rCond} min={0.02} max={3} log onChange={(v) => setRCond(Number(v.toFixed(3)))} unit="Ω" />
          <Slider label={tr("Comprimento")} value={len} min={0.3} max={3} step={0.1} onChange={setLen} unit="m" />
          <Slider label={tr("Capacitância")} value={cap} min={20} max={300} step={5} onChange={setCap} unit={tr("pF/m")} />
        </Controls>
      </div>
      <div className="mt-4 mb-4">
        <Segmented size="sm" value={wiring} onChange={setWiring} options={[{ value: 'se', label: tr("Single-ended (terra compartilhado)") }, { value: 'bal', label: tr("Balanceado (sem terra comum)") }]} />
      </div>
      <Readout
        items={[
          { label: tr("Variação na resposta"), value: `${fmtNum(Math.max(...[20, 100, 1000, 3000, 5000, 10000].map(dev)) - Math.min(...[20, 100, 1000, 3000, 5000, 10000].map(dev)), 3)} dB`, accent: true },
          { label: tr("Perda de nível em 1 kHz"), value: fmtDb(20 * Math.log10(cabs(m.z(1000)) / cabs(cadd(m.z(1000), [rLoop, 0]))), 2) },
          { label: tr("Crosstalk pelo terra"), value: wiring === 'se' ? `${fmtNum(crosstalk, 0)} dB` : tr("desprezível") },
          { label: tr("Polo da capacitância (fonte de 1 Ω)"), value: fc > 1e9 ? tr("{0} GHz", fmtNum(fc / 1e9, 1)) : tr("{0} MHz", fmtNum(fc / 1e6, 0)) },
        ]}
      />
      <div className="mt-3">
        <Note>{tr("A resistência do cabo age como uma pequena impedância de saída adicional: com IEMs multi-BA, alguns décimos de ohm mudam a resposta em centésimos de decibel — muito abaixo do audível na maioria dos casos. Em single-ended, o terra compartilhado gera crosstalk de")}{' '}{wiring === 'se' ? `${fmtNum(crosstalk, 0)} dB` : '—'}{' '}{tr("(separação ainda grande). A capacitância só importaria em megahertz. Cabos importam por conforto, durabilidade, microfonia e conectores — não por “timbre”.")}</Note>
      </div>
    </LabFrame>
  );
}
