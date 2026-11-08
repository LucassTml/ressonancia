import { useMemo, useState } from 'react';
import { LabFrame, Readout, Note } from '../../components/ui/LabFrame';
import { Button, IconCopy, Segmented, Select, Slider, Toggle, fmtDb, fmtHz, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { toEqualizerAPO, FILTER_LABEL } from '../../components/ui/FilterEditor';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, filtersDbAt, interpCurve, logFreqs } from '../../audio/dsp';
import { autoEq, rmsError } from '../../audio/autoeq';
import { useBiquadChain } from '../../audio/useBiquadChain';
import { harmanIE, signatureDb, signatures } from '../../data/targets';
import { useStore } from '../../lib/storage';
import { preferenceFilters, preferenceStore } from '../resposta/PreferenceLab';
import { fitDelta } from '../percepcao/FitLab';
import { tr } from '../../i18n';

const pk = (f: number, fc: number, g: number, q: number) => biquadDb(biquadCoefs({ id: '', type: 'peaking', freq: fc, gain: g, q }, 96000), f, 96000);

const SOURCES = [
  { value: 'real', label: tr("IEM sintético com ressonâncias e um cancelamento") },
  ...signatures.filter((s) => !['neutral', 'harman'].includes(s.id)).map((s) => ({ value: `s:${s.id}`, label: tr("Assinatura: {0}", s.name) })),
];

function sourceFn(id: string) {
  if (id.startsWith('s:')) {
    const s = signatures.find((x) => x.id === id.slice(2))!;
    return (f: number) => signatureDb(s, f);
  }
  return (f: number) =>
    interpCurve(harmanIE.curve, f) - 4 / (1 + Math.pow(f / 90, 2)) + pk(f, 600, 2, 1) + pk(f, 2800, -3, 1.5) + pk(f, 5600, 6, 4) + pk(f, 9000, -18, 14) + pk(f, 12500, 4, 3);
}

export default function AutoEQLab() {
  const pref = useStore(preferenceStore);
  const [src, setSrc] = useState('real');
  const [tgt, setTgt] = useState<'harman' | 'pref'>('harman');
  const [count, setCount] = useState(6);
  const [maxGain, setMaxGain] = useState(6);
  const [bass, setBass] = useState(true);
  const [cond, setCond] = useState<'ideal' | 'leak' | 'deep' | 'unit'>('ideal');
  const [on, setOn] = useState(true);
  const [copied, setCopied] = useState(false);

  const source = useMemo(() => sourceFn(src), [src]);
  const target = useMemo(() => {
    const extra = tgt === 'pref' && pref ? preferenceFilters(pref) : [];
    return (f: number) => interpCurve(harmanIE.curve, f) + filtersDbAt(extra, f);
  }, [tgt, pref]);

  const filters = useMemo(() => autoEq(source, target, { count, fMin: 20, fMax: 16000, maxGain, maxQ: 8, bassShelf: bass }), [source, target, count, maxGain, bass]);
  const eq = useMemo(() => (f: number) => filtersDbAt(filters, f), [filters]);
  const result = (f: number) => source(f) + eq(f);

  const condDelta = useMemo(() => {
    if (cond === 'leak') return fitDelta({ leak: 0.45, insertion: 8, tip: 'silicone', bore: 'standard', hear: true });
    if (cond === 'deep') return fitDelta({ leak: 0, insertion: 12.5, tip: 'silicone', bore: 'standard', hear: true });
    if (cond === 'unit') return (f: number) => pk(f, 300, 1.2, 0.8) + pk(f, 3500, -2, 2) + pk(f, 7000, 2.5, 3);
    return () => 0;
  }, [cond]);
  const inEar = (f: number) => result(f) + condDelta(f);

  const maxBoost = Math.max(0, ...logFreqs(200).map(eq));
  const preamp = -Math.ceil(maxBoost * 10) / 10;
  const player = useBiquadChain('autoeq', filters, { enabled: on, preampDb: preamp });
  const before = rmsError(source, target);
  const after = rmsError(result, target);
  const afterEar = rmsError(inEar, target);
  const apo = toEqualizerAPO(filters, preamp);

  return (
    <LabFrame
      title={tr("AutoEQ e os limites da equalização")}
      description={tr("Um algoritmo ajusta filtros paramétricos para aproximar um IEM de um alvo, como fazem ferramentas como o AutoEq. Depois, mude as condições de uso e veja o que a EQ calculada no acoplador não consegue prever.")}
      audio
      onReset={() => {
        setSrc('real');
        setTgt('harman');
        setCount(6);
        setMaxGain(6);
        setBass(true);
        setCond('ideal');
      }}
      footer={tr("Algoritmo: colocação gulosa de filtros no maior desvio restante (largura pela meia altura), seguida de refinamento local que minimiza o erro quadrático ponderado (peso menor acima de 8 kHz). Reforços limitados para preservar headroom e evitar excursão excessiva. Curvas sintéticas.")}
    >
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Select label={tr("IEM de partida")} value={src} onChange={setSrc} options={SOURCES} />
        <Select label={tr("Alvo")} value={tgt} onChange={(v) => setTgt(v as 'harman' | 'pref')} options={[{ value: 'harman', label: tr("Harman IE 2019") }, { value: 'pref', label: pref ? tr("Minha curva (salva no laboratório de preferência)") : tr("Minha curva (ainda não salva — usa Harman)") }]} />
      </div>
      <FreqPlot
        height={310}
        dbMin={-15}
        dbMax={18}
        dbStep={3}
        curves={[
          { id: 't', label: tr("Alvo"), fn: target, color: 'var(--c-target)', width: 1.6, dash: '6 4' },
          { id: 's', label: tr("IEM original"), fn: source, color: 'var(--c-b)', width: 1.6, opacity: 0.85 },
          { id: 'r', label: tr("IEM + EQ (acoplador)"), fn: result, color: 'var(--c-a)', width: 2.6 },
          ...(cond !== 'ideal' ? [{ id: 'e', label: tr("IEM + EQ (no seu ouvido)"), fn: inEar, color: 'var(--c-diff)', width: 1.8, dash: '3 3' }] : []),
        ]}
        ariaLabel={tr("IEM, alvo e resultado da equalização")}
      />
      <div className="mt-2 mb-4">
        <Legend
          items={[
            { label: tr("Alvo"), color: 'var(--c-target)', dash: true },
            { label: tr("Original"), color: 'var(--c-b)' },
            { label: tr("Com EQ (acoplador)"), color: 'var(--c-a)' },
            ...(cond !== 'ideal' ? [{ label: tr("Com EQ no seu ouvido"), color: 'var(--c-diff)', dash: true }] : []),
          ]}
        />
      </div>
      <div className="grid sm:grid-cols-3 gap-x-6 gap-y-3">
        <Slider label={tr("Número de filtros")} value={count} min={1} max={10} step={1} onChange={setCount} />
        <Slider label={tr("Reforço máximo por filtro")} value={maxGain} min={0} max={12} step={0.5} onChange={setMaxGain} format={fmtDb} />
        <div className="pt-4">
          <Toggle checked={bass} onChange={setBass} label={tr("Low shelf para graves")} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[12.5px] text-muted font-medium mb-1.5">{tr("Condição de uso (o que a medição não sabe)")}</div>
        <Segmented
          size="sm"
          value={cond}
          onChange={setCond}
          options={[
            { value: 'ideal', label: tr("Igual ao acoplador") },
            { value: 'leak', label: tr("Vedação imperfeita") },
            { value: 'deep', label: tr("Inserção mais funda") },
            { value: 'unit', label: tr("Outra unidade") },
          ]}
        />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Desvio do alvo antes (RMS, 20 Hz–10 kHz)"), value: `${fmtNum(before, 2)} dB` },
            { label: tr("Depois, no acoplador"), value: `${fmtNum(after, 2)} dB`, accent: true },
            ...(cond !== 'ideal' ? [{ label: tr("Depois, no seu ouvido"), value: `${fmtNum(afterEar, 2)} dB` }] : []),
            { label: tr("Preamp necessário"), value: fmtDb(preamp) },
          ]}
        />
      </div>
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-1.5 pr-3 font-medium">#</th>
                <th className="py-1.5 pr-3 font-medium">{tr("Tipo")}</th>
                <th className="py-1.5 pr-3 font-medium">{tr("Frequência")}</th>
                <th className="py-1.5 pr-3 font-medium">{tr("Ganho")}</th>
                <th className="py-1.5 font-medium">Q</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {filters.map((f, i) => (
                <tr key={f.id} className="border-b border-line">
                  <td className="py-1.5 pr-3 text-faint">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-sans">{FILTER_LABEL[f.type]}</td>
                  <td className="py-1.5 pr-3">{fmtHz(f.freq)}</td>
                  <td className="py-1.5 pr-3">{fmtDb(f.gain)}</td>
                  <td className="py-1.5">{fmtNum(f.q, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <pre className="text-[11.5px] font-mono bg-sunken border border-line rounded-xl px-3 py-2.5 overflow-x-auto leading-relaxed">{apo}</pre>
          <Button size="sm" variant="ghost" className="mt-1" icon={<IconCopy size={14} />} onClick={() => void navigator.clipboard?.writeText(apo).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
            {copied ? tr("Copiado") : tr("Copiar para Equalizer APO")}
          </Button>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-line">
        <SourceBar player={player} extra={<Toggle checked={on} onChange={setOn} label={on ? tr("Ouvindo com a EQ calculada") : tr("Sem EQ")} />} />
      </div>
      <div className="mt-3">
        <Note>{tr("Repare no IEM sintético: o vale estreito e profundo em 9 kHz (um cancelamento) quase não é corrigido — exigiria um reforço enorme e estreito, que o algoritmo limita de propósito. Com “vedação imperfeita”, a EQ perfeita no acoplador deixa um déficit de grave no seu ouvido; com “inserção mais funda”, os agudos mudam. A EQ corrige o fone; não corrige o encaixe.")}</Note>
      </div>
    </LabFrame>
  );
}
