import { useState } from 'react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { NumberField, Segmented, Slider, fmtNum } from '../../components/ui/controls';
import { tr } from '../../i18n';

const SOURCES = [
  { id: 'good', name: tr("Dongle silencioso"), noise: 1.5 },
  { id: 'phone', name: tr("Saída de celular típica"), noise: 5 },
  { id: 'laptop', name: tr("Notebook com ruído"), noise: 20 },
  { id: 'desk-hi', name: tr("Amp de mesa, ganho alto"), noise: 40 },
];

export default function HissLab() {
  const [noise, setNoise] = useState(5);
  const [sens, setSens] = useState(110);
  const [unit, setUnit] = useState<'V' | 'mW'>('V');
  const [z, setZ] = useState(16);
  const [ambient, setAmbient] = useState(25);
  const [isolation, setIsolation] = useState(25);

  const dbV = unit === 'V' ? sens : sens + 10 * Math.log10(1000 / z);
  const hissSpl = dbV + 20 * Math.log10(noise * 1e-6);
  const inEar = ambient - isolation;
  const verdict = hissSpl < 0 ? tr("Inaudível: abaixo do limiar de audição.") : hissSpl < inEar ? tr("Provavelmente mascarado pelo ruído ambiente que atravessa a vedação.") : hissSpl < 10 ? tr("Audível em silêncio, entre faixas ou em passagens muito baixas.") : tr("Chiado claramente audível.");

  return (
    <LabFrame
      title={tr("Calculadora de chiado (hiss)")}
      description={tr("O ruído de fundo de uma fonte é uma tensão pequena e constante. Num fone pouco sensível, ela some; num IEM muito sensível, vira um chiado. Estime o nível que chega ao seu ouvido.")}
      onReset={() => {
        setNoise(5);
        setSens(110);
        setUnit('V');
        setZ(16);
      }}
      footer={tr("Estimativa para ruído de banda larga. O limiar de audição para ruído varia com o espectro (o chiado é mais audível na região de 2–5 kHz). Especificações de ruído costumam ser ponderadas em A, entre 20 Hz e 20 kHz.")}
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SOURCES.map((s) => (
          <button key={s.id} onClick={() => setNoise(s.noise)} className={`text-[12.5px] px-2.5 py-1 rounded-lg border transition-colors ${noise === s.noise ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg'}`}>
            {s.name} · {s.noise} µV
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        <Slider label={tr("Ruído de saída da fonte")} value={noise} min={0.3} max={100} log onChange={(v) => setNoise(Number(v.toFixed(1)))} unit="µV" />
        <div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={tr("Sensibilidade do fone")} value={sens} onChange={setSens} unit={unit === 'V' ? 'dB/V' : 'dB/mW'} step={0.5} />
            <NumberField label={tr("Impedância")} value={z} onChange={(v) => setZ(Math.max(1, v))} unit="Ω" />
          </div>
          <div className="mt-2">
            <Segmented size="sm" value={unit} onChange={setUnit} options={[{ value: 'V', label: tr("dB/V") }, { value: 'mW', label: tr("dB/mW") }]} />
          </div>
        </div>
        <Slider label={tr("Ruído ambiente")} value={ambient} min={15} max={80} step={1} onChange={setAmbient} unit={tr("dB(A)")} hint={tr("Quarto silencioso ≈ 25–30; escritório ≈ 45–50; ônibus ≈ 70–80.")} />
        <Slider label={tr("Isolamento do IEM")} value={isolation} min={0} max={40} step={1} onChange={setIsolation} unit="dB" />
      </div>
      <div className="mt-5">
        <Readout
          items={[
            { label: tr("Sensibilidade em dB/V"), value: `${fmtNum(dbV, 1)} dB/V` },
            { label: tr("Chiado no ouvido"), value: `${fmtNum(hissSpl, 1)} dB SPL`, accent: true },
            { label: tr("Ambiente que passa pela vedação"), value: `${fmtNum(inEar, 1)} dB` },
          ]}
        />
      </div>
      <p className="mt-3 text-[13.5px] text-soft">{verdict}</p>
      <div className="mt-3">
        <Note>{tr("SPL do ruído = sensibilidade (dB/V) + 20·log₁₀(tensão de ruído em volts). Um IEM de 120 dB/V com 5 µV de ruído produz cerca de 14 dB SPL de chiado — audível no silêncio. Com 1 µV, cai para 0 dB SPL. A mesma fonte num headphone de 100 dB/V fica inaudível.")}</Note>
      </div>
    </LabFrame>
  );
}
