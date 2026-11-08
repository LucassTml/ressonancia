import { useState } from 'react';
import { motion } from 'motion/react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { NumberField, Segmented, Slider, fmtNum } from '../../components/ui/controls';
import { locale, tr } from '../../i18n';

const LADDER = [
  { db: 0, label: tr("Limiar da audição (1 kHz)") },
  { db: 20, label: tr("Folhas ao vento, estúdio silencioso") },
  { db: 35, label: tr("Quarto à noite") },
  { db: 60, label: tr("Conversa a 1 m") },
  { db: 75, label: tr("Escuta confortável em fones (típica)") },
  { db: 85, label: tr("Limite ocupacional para 8 h (NIOSH)") },
  { db: 94, label: tr("1 Pa: calibrador de microfones") },
  { db: 105, label: tr("Show de rock, perto do palco") },
  { db: 120, label: tr("Limiar de desconforto/dor") },
  { db: 140, label: tr("Jato decolando a ~30 m") },
];

function siPa(p: number) {
  if (p >= 1) return `${fmtNum(p, 2)} Pa`;
  if (p >= 1e-3) return `${fmtNum(p * 1e3, 2)} mPa`;
  return `${fmtNum(p * 1e6, 1)} µPa`;
}

export default function DecibelLab() {
  const [tab, setTab] = useState<'spl' | 'ratio' | 'sum' | 'volts'>('spl');
  const [spl, setSpl] = useState(60);
  const [ratio, setRatio] = useState(2);
  const [l1, setL1] = useState(80);
  const [l2, setL2] = useState(80);
  const [n, setN] = useState(2);
  const [vrms, setVrms] = useState(1);
  const [fs, setFs] = useState(2);

  const p = 20e-6 * Math.pow(10, spl / 20);
  const reset = () => {
    setSpl(60);
    setRatio(2);
    setL1(80);
    setL2(80);
    setN(2);
    setVrms(1);
    setFs(2);
  };

  return (
    <LabFrame
      title={tr("Calculadora de decibéis")}
      description={tr("Quatro usos do decibel, com as contas feitas na hora. Ele sempre expressa uma razão — e só tem significado absoluto quando a referência é declarada.")}
      onReset={reset}
      toolbar={
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'spl', label: tr("dB SPL") },
            { value: 'ratio', label: tr("Razões") },
            { value: 'sum', label: tr("Somar fontes") },
            { value: 'volts', label: tr("dBV · dBu · dBFS") },
          ]}
        />
      }
    >
      {tab === 'spl' && (
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-6">
          <div className="space-y-5">
            <Slider label={tr("Nível de pressão sonora")} value={spl} min={0} max={140} step={1} onChange={setSpl} unit={tr("dB SPL")} />
            <Readout
              items={[
                { label: tr("Pressão RMS"), value: siPa(p), accent: true },
                { label: tr("Razão em relação a 20 µPa"), value: `${p / 20e-6 >= 1e4 ? (p / 20e-6).toLocaleString(locale, { notation: 'scientific', maximumFractionDigits: 1 }) : fmtNum(p / 20e-6, 1)}×` },
                { label: tr("Intensidade"), value: `${((p * p) / 413).toLocaleString(locale, { notation: 'scientific', maximumFractionDigits: 1 })} W/m²` },
              ]}
            />
            <div>
              <div className="text-[12px] text-muted mb-1.5">{tr("Mesma pressão em escala linear (0 a 200 Pa)")}</div>
              <div className="h-2.5 rounded-full bg-sunken overflow-hidden">
                <motion.div className="h-full bg-accent" animate={{ width: `${Math.max(0.15, (p / 200) * 100)}%` }} transition={{ type: 'spring', stiffness: 220, damping: 30 }} />
              </div>
              <Note>{tr("Numa escala linear, tudo abaixo de ~100 dB SPL é praticamente invisível. A escala logarítmica comprime 7 ordens de grandeza de pressão em uma régua de 0 a 140 — parecida com o modo como a audição se comporta.")}</Note>
            </div>
          </div>
          <ol className="relative border-l border-line ml-2 h-[400px]">
            {LADDER.map((r) => {
              const active = Math.abs(r.db - spl) < 5;
              return (
                <li key={r.db} className="absolute left-0 right-0 pl-4 -translate-y-1/2 leading-tight" style={{ top: `${(r.db / 140) * 100}%` }}>
                  <span className={`absolute -left-[4.5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${active ? 'bg-accent' : 'bg-line-strong'}`} />
                  <span className={`font-mono tabular text-[12px] mr-2 ${active ? 'text-accent' : 'text-faint'}`}>{r.db} dB</span>
                  <span className={`text-[13px] ${active ? 'text-fg' : 'text-muted'}`}>{r.label}</span>
                </li>
              );
            })}
            <motion.span
              className="absolute -left-[7px] w-3.5 h-3.5 rounded-full border-2 border-accent bg-elev"
              style={{ marginTop: -7 }}
              animate={{ top: `${(spl / 140) * 100}%` }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              aria-hidden
            />
          </ol>
        </div>
      )}

      {tab === 'ratio' && (
        <div className="space-y-5">
          <Controls cols={2}>
            <Slider label={tr("Razão (fator multiplicativo)")} value={ratio} min={0.01} max={1000} log onChange={(v) => setRatio(Number(v.toPrecision(3)))} unit="×" />
          </Controls>
          <Readout
            items={[
              { label: tr("Se for amplitude (pressão, tensão): 20·log₁₀"), value: `${fmtNum(20 * Math.log10(ratio), 2)} dB`, accent: true },
              { label: tr("Se for potência (ou intensidade): 10·log₁₀"), value: `${fmtNum(10 * Math.log10(ratio), 2)} dB` },
            ]}
          />
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-[13px] text-soft">
            {[
              [tr("Dobrar a tensão ou a pressão"), '+6,02 dB'],
              [tr("Dobrar a potência"), '+3,01 dB'],
              [tr("Tensão ×10"), '+20 dB'],
              [tr("Potência ×10"), '+10 dB'],
              [tr("Metade da tensão"), '−6,02 dB'],
              [tr("Potência ×1000"), '+30 dB'],
            ].map(([a, b]) => (
              <div key={a} className="flex justify-between border-b border-line py-1.5">
                <span>{a}</span>
                <span className="font-mono tabular text-fg">{b}</span>
              </div>
            ))}
          </div>
          <Note>{tr("O mesmo número de dB descreve a mesma mudança física qualquer que seja a grandeza: +6 dB de tensão num fone geram +6 dB de pressão sonora (num sistema linear), e exigem 4× mais potência.")}</Note>
        </div>
      )}

      {tab === 'sum' && (
        <div className="space-y-5">
          <Controls cols={3}>
            <Slider label={tr("Fonte 1")} value={l1} min={40} max={110} step={1} onChange={setL1} unit="dB" />
            <Slider label={tr("Fonte 2")} value={l2} min={40} max={110} step={1} onChange={setL2} unit="dB" />
            <Slider label={tr("N fontes iguais à fonte 1")} value={n} min={1} max={100} step={1} onChange={setN} />
          </Controls>
          <Readout
            items={[
              { label: tr("Fonte 1 + fonte 2 (incoerentes)"), value: `${fmtNum(10 * Math.log10(10 ** (l1 / 10) + 10 ** (l2 / 10)), 1)} dB`, accent: true },
              { label: tr("Fonte 1 + 2, coerentes e em fase"), value: `${fmtNum(20 * Math.log10(10 ** (l1 / 20) + 10 ** (l2 / 20)), 1)} dB` },
              { label: tr("{0} fontes iguais (incoerentes)", n), value: `${fmtNum(l1 + 10 * Math.log10(n), 1)} dB` },
              { label: tr("Diferença entre as fontes"), value: `${fmtNum(Math.abs(l1 - l2), 0)} dB` },
            ]}
          />
          <Note>{tr("Sons independentes (ruído, instrumentos diferentes) somam")}{' '}<em>{tr("potências")}</em>{tr(": dois iguais dão +3 dB, não o dobro em dB. Sinais idênticos e em fase somam")}{' '}<em>{tr("amplitudes")}</em>{tr(": +6 dB. Se uma fonte está 10 dB abaixo da outra, ela acrescenta só ~0,4 dB ao total — o que explica por que ruídos baixos “somem” na soma, mas não do ouvido.")}</Note>
        </div>
      )}

      {tab === 'volts' && (
        <div className="space-y-5">
          <Controls cols={2}>
            <NumberField label={tr("Tensão RMS do sinal")} value={vrms} onChange={setVrms} unit="V" step={0.01} min={0} />
            <NumberField label={tr("Fundo de escala do DAC (0 dBFS)")} value={fs} onChange={setFs} unit={tr("V RMS")} step={0.1} min={0.01} />
          </Controls>
          <Readout
            items={[
              { label: tr("dBV (ref. 1 V)"), value: `${fmtNum(20 * Math.log10(Math.max(vrms, 1e-9)), 2)} dBV`, accent: true },
              { label: tr("dBu (ref. 0,775 V)"), value: `${fmtNum(20 * Math.log10(Math.max(vrms, 1e-9) / 0.7746), 2)} dBu` },
              { label: tr("dBFS (neste DAC)"), value: `${fmtNum(20 * Math.log10(Math.max(vrms, 1e-9) / fs), 2)} dBFS` },
              { label: tr("Tensão de pico (senoide)"), value: `${fmtNum(vrms * Math.SQRT2, 3)} V` },
            ]}
          />
          <Note>{tr("dBu = dBV + 2,21. O nível de linha profissional (+4 dBu ≈ 1,23 V) é cerca de 12 dB acima do nível de consumo (−10 dBV ≈ 0,32 V). dBFS não tem tensão fixa: depende de qual tensão o DAC entrega no fundo de escala — por isso o mesmo arquivo a −20 dBFS pode gerar níveis muito diferentes em aparelhos diferentes.")}</Note>
        </div>
      )}
    </LabFrame>
  );
}
