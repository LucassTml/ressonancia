import { useState } from 'react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { NumberField, Segmented, Slider, fmtNum } from '../../components/ui/controls';
import { tr } from '../../i18n';

function si(v: number, unit: string) {
  const a = Math.abs(v);
  if (a >= 1) return `${fmtNum(v, 2)} ${unit}`;
  if (a >= 1e-3) return `${fmtNum(v * 1e3, a >= 0.01 ? 1 : 2)} m${unit}`;
  return `${fmtNum(v * 1e6, 1)} µ${unit}`;
}

interface Phone {
  z: number;
  sens: number;
  unit: 'mW' | 'V';
}

function calc(p: Phone, spl: number, vmax: number, zout: number) {
  const dbV = p.unit === 'V' ? p.sens : p.sens + 10 * Math.log10(1000 / p.z);
  const dbmW = p.unit === 'mW' ? p.sens : p.sens - 10 * Math.log10(1000 / p.z);
  const v = Math.pow(10, (spl - dbV) / 20); // V RMS no fone
  const i = v / p.z;
  const pw = v * i;
  // tensão disponível no fone considerando divisor com a impedância de saída
  const vAvail = vmax * (p.z / (p.z + zout));
  const maxSpl = dbV + 20 * Math.log10(Math.max(vAvail, 1e-9));
  return { dbV, dbmW, v, i, pw, maxSpl, headroom: maxSpl - spl, vAvail };
}

const PRESETS: { id: string; name: string; p: Phone }[] = [
  { id: 'iem-ba', name: tr("IEM BA sensível (16 Ω, 112 dB/mW)"), p: { z: 16, sens: 112, unit: 'mW' } },
  { id: 'iem-dd', name: tr("IEM dinâmico (32 Ω, 108 dB/V)"), p: { z: 32, sens: 108, unit: 'V' } },
  { id: 'iem-planar', name: tr("IEM planar (16 Ω, 98 dB/V)"), p: { z: 16, sens: 98, unit: 'V' } },
  { id: 'hp-32', name: tr("Headphone 32 Ω, 90 dB/mW"), p: { z: 32, sens: 90, unit: 'mW' } },
  { id: 'hp-300', name: tr("Headphone 300 Ω, 102 dB/mW"), p: { z: 300, sens: 102, unit: 'mW' } },
  { id: 'hp-planar', name: tr("Headphone planar 50 Ω, 86 dB/mW"), p: { z: 50, sens: 86, unit: 'mW' } },
];

const SOURCES = [
  { id: 'phone', name: tr("Saída de celular/notebook típica"), v: 0.5, z: 2 },
  { id: 'dongle', name: tr("Dongle USB típico"), v: 1, z: 1 },
  { id: 'dongle-bal', name: tr("Dongle com saída balanceada"), v: 2, z: 1.5 },
  { id: 'desk', name: tr("Amplificador de mesa"), v: 7, z: 0.5 },
];

function PhoneEditor({ p, set, label, color }: { p: Phone; set: (p: Phone) => void; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[13px] font-semibold" style={{ color }}>{label}</span>
        <select
          className="h-7 max-w-[60%] rounded-md border border-line-strong bg-elev px-1.5 text-[12px]"
          value=""
          onChange={(e) => {
            const pr = PRESETS.find((x) => x.id === e.target.value);
            if (pr) set(pr.p);
          }}
          aria-label={tr("Exemplo para {0}", label)}
        >
          <option value="">{tr("Exemplos…")}</option>
          {PRESETS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={tr("Impedância nominal")} value={p.z} onChange={(z) => set({ ...p, z: Math.max(1, z) })} unit="Ω" />
        <NumberField label={tr("Sensibilidade")} value={p.sens} onChange={(s) => set({ ...p, sens: s })} unit={p.unit === 'mW' ? 'dB/mW' : 'dB/V'} step={0.5} />
      </div>
      <div className="mt-2">
        <Segmented
          size="sm"
          value={p.unit}
          onChange={(u) => {
            // converte o valor ao trocar de unidade, mantendo o mesmo fone
            const conv = 10 * Math.log10(1000 / p.z);
            set({ ...p, unit: u, sens: Number((u === 'V' ? p.sens + conv : p.sens - conv).toFixed(1)) });
          }}
          options={[
            { value: 'mW', label: tr("dB SPL / mW") },
            { value: 'V', label: tr("dB SPL / V") },
          ]}
        />
      </div>
    </div>
  );
}

function Results({ r, color, peak }: { r: ReturnType<typeof calc>; color: string; peak: number }) {
  return (
    <Readout
      items={[
        { label: tr("Sensibilidade equivalente"), value: `${fmtNum(r.dbV, 1)} dB/V · ${fmtNum(r.dbmW, 1)} dB/mW` },
        { label: tr("Tensão para {0} dB (pico)", peak), value: si(r.v, 'V'), accent: true },
        { label: tr("Corrente"), value: si(r.i, 'A') },
        { label: tr("Potência"), value: si(r.pw, 'W') },
        { label: tr("SPL máximo com esta fonte"), value: `${fmtNum(r.maxSpl, 1)} dB`, hint: <span style={{ color: r.headroom >= 0 ? 'var(--accent)' : 'var(--myth)' }}>{r.headroom >= 0 ? tr("sobram {0} dB", fmtNum(r.headroom, 1)) : tr("faltam {0} dB", fmtNum(-r.headroom, 1))}</span> },
      ].map((x, i) => (i === 1 ? { ...x, label: <span style={{ color }}>{x.label}</span> } : x))}
    />
  );
}

export default function PowerLab() {
  const [a, setA] = useState<Phone>(PRESETS[3].p);
  const [b, setB] = useState<Phone>(PRESETS[4].p);
  const [spl, setSpl] = useState(85);
  const [crest, setCrest] = useState(15);
  const [vmax, setVmax] = useState(1);
  const [zout, setZout] = useState(1);
  const [compare, setCompare] = useState(true);

  const peak = spl + crest;
  const ra = calc(a, peak, vmax, zout);
  const rb = calc(b, peak, vmax, zout);

  return (
    <LabFrame
      title={tr("Calculadora de tensão, corrente e potência")}
      description={tr("Quanto um fone exige para chegar a um nível sonoro — e se a sua fonte dá conta. Informe a impedância e a sensibilidade (em dB/mW ou dB/V), o volume desejado e a fonte.")}
      onReset={() => {
        setA(PRESETS[3].p);
        setB(PRESETS[4].p);
        setSpl(85);
        setCrest(15);
        setVmax(1);
        setZout(1);
      }}
      toolbar={<Segmented size="sm" value={compare ? 'two' : 'one'} onChange={(v) => setCompare(v === 'two')} options={[{ value: 'one', label: tr("Um fone") }, { value: 'two', label: tr("Comparar dois") }]} />}
      footer={tr("Limitações: a sensibilidade é especificada em 1 kHz e a impedância nominal ignora a variação com a frequência; fabricantes nem sempre informam com precisão. Fontes reais podem ter limite de corrente além do limite de tensão. Os resultados são estimativas para orientar, não garantias.")}
    >
      <div className={`grid gap-3 ${compare ? 'md:grid-cols-2' : ''}`}>
        <PhoneEditor p={a} set={setA} label={tr("Fone A")} color="var(--c-a)" />
        {compare && <PhoneEditor p={b} set={setB} label={tr("Fone B")} color="var(--c-b)" />}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4">
        <Slider label={tr("Volume médio desejado")} value={spl} min={60} max={100} step={1} onChange={setSpl} unit={tr("dB SPL")} />
        <Slider label={tr("Margem para picos (fator de crista)")} value={crest} min={0} max={20} step={1} onChange={setCrest} unit="dB" hint={tr("Música dinâmica: 15–20 dB. Música muito comprimida: 6–10 dB.")} />
        <div>
          <div className="text-[12.5px] text-muted font-medium mb-1">{tr("Fonte")}</div>
          <select
            className="w-full h-9 rounded-[9px] border border-line-strong bg-elev px-2.5 text-[13.5px]"
            value=""
            onChange={(e) => {
              const s = SOURCES.find((x) => x.id === e.target.value);
              if (s) {
                setVmax(s.v);
                setZout(s.z);
              }
            }}
            aria-label={tr("Exemplos de fonte")}
          >
            <option value="">{tr("Exemplos de fonte…")}</option>
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.v} V, {s.z} Ω)
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={tr("Tensão máx. da fonte")} value={vmax} onChange={(v) => setVmax(Math.max(0.01, v))} unit={tr("V RMS")} step={0.1} />
          <NumberField label={tr("Impedância de saída")} value={zout} onChange={(v) => setZout(Math.max(0, v))} unit="Ω" step={0.1} />
        </div>
      </div>
      <div className={`grid gap-3 mt-5 ${compare ? 'md:grid-cols-2' : ''}`}>
        <Results r={ra} color="var(--c-a)" peak={peak} />
        {compare && <Results r={rb} color="var(--c-b)" peak={peak} />}
      </div>
      <div className="mt-4 space-y-2">
        <Note>{tr("Contas: dB/V = dB/mW + 10·log₁₀(1000/Z). Tensão necessária V = 10^((SPL − dB/V)/20). Corrente I = V/Z. Potência P = V²/Z. A tensão que chega ao fone é reduzida pelo divisor entre a impedância de saída e a do fone.")}</Note>
        {compare && (
          <Note>
            {ra.v > rb.v && a.z < b.z
              ? tr("Repare: o fone A tem impedância menor ({0} Ω) mas exige MAIS tensão que o B ({1} Ω). Baixa impedância não significa fácil de tocar — o que manda na tensão necessária é a sensibilidade em dB/V. A impedância decide quanta corrente essa tensão vai puxar.", a.z, b.z)
              : tr("Compare tensão e corrente: a sensibilidade em dB/V decide quanta tensão é necessária; a impedância decide quanta corrente (e potência) essa tensão vai exigir. Experimente o exemplo de headphone de 32 Ω contra o de 300 Ω.")}
          </Note>
        )}
      </div>
    </LabFrame>
  );
}
