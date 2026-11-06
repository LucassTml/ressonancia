import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LabFrame, Note, Readout } from '../../components/ui/LabFrame';
import { Button, IconCopy, Segmented, Slider, Toggle, fmtDb, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { toEqualizerAPO } from '../../components/ui/FilterEditor';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { filtersDbAt, interpCurve, type FilterSpec } from '../../audio/dsp';
import { useCurvePlayer } from '../../audio/useCurvePlayer';
import { harmanIE } from '../../data/targets';
import { createPersistentStore, useStore } from '../../lib/storage';

type Param = 'bass' | 'lowmid' | 'presence' | 'treble' | 'air';
export type Preference = Record<Param, number>;

export const preferenceStore = createPersistentStore<Preference | null>('preference-curve', null);

const PARAMS: { id: Param; name: string; filter: Omit<FilterSpec, 'id' | 'gain'>; min: number; max: number; help: string }[] = [
  { id: 'bass', name: 'Graves (shelf 105 Hz)', filter: { type: 'lowshelf', freq: 105, q: 0.707 }, min: -6, max: 12, help: 'Peso e impacto. Ajuste com música que você conhece bem; desconfie de ruído rosa aqui.' },
  { id: 'lowmid', name: 'Médios-graves (300 Hz)', filter: { type: 'peaking', freq: 300, q: 0.8 }, min: -5, max: 5, help: 'Corpo e calor de vozes e instrumentos. Em excesso, embola.' },
  { id: 'presence', name: 'Presença (3 kHz)', filter: { type: 'peaking', freq: 3000, q: 1.1 }, min: -6, max: 6, help: 'Articulação e proximidade. É a região mais sensível: mudanças de 1–2 dB já são audíveis.' },
  { id: 'treble', name: 'Agudos (shelf 6 kHz)', filter: { type: 'highshelf', freq: 6000, q: 0.707 }, min: -6, max: 6, help: 'Brilho, pratos e sibilantes. Muito dependente da inserção — ajuste com o IEM bem encaixado.' },
  { id: 'air', name: 'Ar (shelf 12 kHz)', filter: { type: 'highshelf', freq: 12000, q: 0.707 }, min: -6, max: 6, help: 'Abertura e “ar”. Sutil; se não ouvir diferença, deixe em 0.' },
];

const ZERO: Preference = { bass: 0, lowmid: 0, presence: 0, treble: 0, air: 0 };

export function preferenceFilters(p: Preference): FilterSpec[] {
  return PARAMS.map((x) => ({ ...x.filter, id: x.id, gain: p[x.id], enabled: p[x.id] !== 0 }));
}

interface Stair {
  value: number;
  step: number;
  dir: 1 | -1;
  swap: boolean; // posição aleatória do candidato
  listening: 0 | 1;
  done: boolean;
  trials: number;
}
const newStair = (value: number): Stair => ({ value, step: 4, dir: 1, swap: Math.random() < 0.5, listening: 0, done: false, trials: 0 });

export default function PreferenceLab() {
  const saved = useStore(preferenceStore);
  const [p, setP] = useState<Preference>(saved ?? ZERO);
  const [step, setStep] = useState<Param | 'result'>('bass');
  const [bypass, setBypass] = useState(false);
  const [blind, setBlind] = useState(false);
  const [stairs, setStairs] = useState<Record<Param, Stair>>(() => Object.fromEntries(PARAMS.map((x) => [x.id, newStair(0)])) as Record<Param, Stair>);
  const [assume, setAssume] = useState<'harman' | 'unknown'>('harman');
  const [copied, setCopied] = useState(false);

  const current = step === 'result' ? null : PARAMS.find((x) => x.id === step)!;
  const stair = current ? stairs[current.id] : null;

  // valor efetivamente aplicado agora (no modo cego, depende da opção ouvida)
  const listenPref = useMemo<Preference>(() => {
    if (!blind || !current || !stair || stair.done) return p;
    const cand = Math.max(current.min, Math.min(current.max, stair.value + stair.dir * stair.step));
    const opts = stair.swap ? [cand, stair.value] : [stair.value, cand];
    return { ...p, [current.id]: opts[stair.listening] };
  }, [blind, current, stair, p]);

  const fn = useMemo(() => {
    const fl = preferenceFilters(listenPref);
    return (f: number) => filtersDbAt(fl, f);
  }, [listenPref]);
  const { player } = useCurvePlayer('preference', fn, !bypass);

  const choose = (which: 0 | 1) => {
    if (!current || !stair) return;
    const cand = Math.max(current.min, Math.min(current.max, stair.value + stair.dir * stair.step));
    const pickedCandidate = (stair.swap ? 0 : 1) === which;
    let next: Stair;
    if (pickedCandidate) next = { ...stair, value: cand, trials: stair.trials + 1, swap: Math.random() < 0.5, listening: 0 };
    else {
      const ns = stair.step / 2;
      next = { ...stair, dir: (-stair.dir) as 1 | -1, step: ns, trials: stair.trials + 1, swap: Math.random() < 0.5, listening: 0, done: ns < 0.75 || stair.trials > 10 };
    }
    if (cand === stair.value) next.done = true;
    setStairs((s) => ({ ...s, [current.id]: next }));
    setP((pp) => ({ ...pp, [current.id]: next.value }));
  };

  const filters = preferenceFilters(p).filter((f) => f.enabled);
  const maxBoost = Math.max(0, ...[20, 50, 100, 3000, 8000, 12000, 16000].map((f) => filtersDbAt(filters, f)));
  const apo = toEqualizerAPO(filters, -Math.ceil(maxBoost * 10) / 10);
  const delta = (f: number) => filtersDbAt(preferenceFilters(p), f);
  const est = (f: number) => interpCurve(harmanIE.curve, f) + delta(f);

  return (
    <LabFrame
      title="Sua curva de preferência"
      description="Ajuste cinco regiões, uma de cada vez, ouvindo música que você conhece. No modo cego, você só escolhe entre duas opções sem ver os números, e o laboratório converge para o seu ponto preferido por uma escada adaptativa."
      audio
      onReset={() => {
        setP(ZERO);
        setStairs(Object.fromEntries(PARAMS.map((x) => [x.id, newStair(0)])) as Record<Param, Stair>);
        setStep('bass');
      }}
      footer="Os ajustes são relativos ao fone que você está usando agora. Se ele estiver próximo do alvo Harman, a curva estimada é uma boa aproximação da sua preferência absoluta; se não, os ajustes valem como EQ para este fone."
    >
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Segmented
          size="sm"
          value={step}
          onChange={setStep}
          options={[
            ...PARAMS.map((x, i) => ({ value: x.id, label: `${i + 1}. ${x.name.split(' (')[0]}` })),
            { value: 'result' as const, label: 'Resultado' },
          ]}
        />
        <Toggle checked={blind} onChange={setBlind} label="Modo cego" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step + String(blind)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
          {current && stair ? (
            <div className="grid md:grid-cols-[1.1fr_1fr] gap-6">
              <div>
                <h4 className="text-[15px] font-semibold text-fg">{current.name}</h4>
                <p className="text-[13px] text-muted leading-relaxed mt-1 mb-4">{current.help}</p>
                {!blind ? (
                  <>
                    <Slider label="Ajuste" value={p[current.id]} min={current.min} max={current.max} step={0.5} onChange={(v) => setP((pp) => ({ ...pp, [current.id]: v }))} format={fmtDb} />
                    <div className="mt-3">
                      <Toggle checked={bypass} onChange={setBypass} label="Comparar com todos os ajustes desligados" />
                    </div>
                  </>
                ) : stair.done ? (
                  <div className="rounded-xl bg-accent-soft px-4 py-3 text-[13.5px] text-soft">
                    Convergiu em <strong className="text-fg">{fmtDb(stair.value)}</strong> após {stair.trials} escolhas.{' '}
                    <button className="underline text-accent" onClick={() => setStairs((s) => ({ ...s, [current.id]: newStair(stair.value) }))}>
                      Refazer
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1].map((k) => (
                        <button
                          key={k}
                          onClick={() => setStairs((s) => ({ ...s, [current.id]: { ...stair, listening: k as 0 | 1 } }))}
                          className={`rounded-xl border px-4 py-4 text-left transition-colors ${stair.listening === k ? 'border-accent bg-accent-soft' : 'border-line hover:bg-sunken'}`}
                        >
                          <span className="block text-[12px] text-muted">{stair.listening === k ? 'Ouvindo' : 'Ouvir'}</span>
                          <span className="block text-[17px] font-semibold text-fg">Opção {k + 1}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button onClick={() => choose(0)}>Prefiro a 1</Button>
                      <Button onClick={() => choose(1)}>Prefiro a 2</Button>
                    </div>
                    <p className="mt-2 text-[12px] text-faint">
                      Escolha {stair.trials + 1} · diferença atual entre as opções: {fmtNum(stair.step, 1)} dB. Alterne várias vezes antes de decidir.
                    </p>
                  </>
                )}
              </div>
              <div>
                <FreqPlot height={200} dbMin={-9} dbMax={12} dbStep={3} readout={false} curves={[{ id: 'd', label: 'Ajustes', fn: blind ? () => 0 : delta, color: 'var(--c-a)', width: 2.2, fill: true }]} ariaLabel="Seus ajustes" />
                {blind && <p className="text-[12px] text-faint mt-1">Curva oculta no modo cego.</p>}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-[13px] text-muted">Meu fone atual é:</span>
                <Segmented size="sm" value={assume} onChange={setAssume} options={[{ value: 'harman', label: 'Próximo do Harman' }, { value: 'unknown', label: 'Não sei' }]} />
              </div>
              <FreqPlot
                height={290}
                dbMin={assume === 'harman' ? -12 : -9}
                dbMax={assume === 'harman' ? 21 : 12}
                dbStep={3}
                curves={
                  assume === 'harman'
                    ? [
                        { id: 'h', label: 'Harman IE 2019', fn: (f) => interpCurve(harmanIE.curve, f), color: 'var(--c-target)', width: 1.5, dash: '5 4' },
                        { id: 'me', label: 'Sua curva estimada', fn: est, color: 'var(--c-a)', width: 2.6 },
                      ]
                    : [{ id: 'd', label: 'Seus ajustes', fn: delta, color: 'var(--c-a)', width: 2.4, fill: true }]
                }
                ariaLabel="Sua curva de preferência"
              />
              <div className="mt-2 mb-4">
                <Legend items={assume === 'harman' ? [{ label: 'Harman IE 2019', color: 'var(--c-target)', dash: true }, { label: 'Sua curva estimada', color: 'var(--c-a)' }] : [{ label: 'Seus ajustes (EQ para este fone)', color: 'var(--c-a)' }]} />
              </div>
              <Readout items={PARAMS.map((x) => ({ label: x.name, value: fmtDb(p[x.id]), accent: p[x.id] !== 0 }))} />
              <div className="mt-5 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[12.5px] text-muted font-medium mb-1.5">Equalizer APO / Peace (Windows), Wavelet e outros</div>
                  <pre className="text-[12px] font-mono bg-sunken border border-line rounded-xl px-3.5 py-3 overflow-x-auto leading-relaxed">{apo}</pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1"
                    icon={<IconCopy size={14} />}
                    onClick={() => {
                      void navigator.clipboard?.writeText(apo).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                  >
                    {copied ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>
                <div className="space-y-3">
                  <Button variant="primary" onClick={() => preferenceStore.set(p)}>
                    {saved && JSON.stringify(saved) === JSON.stringify(p) ? 'Salva neste navegador' : 'Salvar minha curva'}
                  </Button>
                  <Note>
                    A curva salva fica disponível como alvo no laboratório de autoEQ (módulo de equalização). Repita o processo em outro dia, com
                    outra música: preferências estáveis entre sessões são as confiáveis.
                  </Note>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 pt-4 border-t border-line">
        <SourceBar player={player} />
      </div>
    </LabFrame>
  );
}
