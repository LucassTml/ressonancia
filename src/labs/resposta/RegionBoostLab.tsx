import { useMemo, useState } from 'react';
import { LabFrame, Controls, Note } from '../../components/ui/LabFrame';
import { Slider, Toggle, fmtDb } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FreqPlot } from '../../viz/FreqPlot';
import { filtersDbAt, type FilterSpec } from '../../audio/dsp';
import { useCurvePlayer } from '../../audio/useCurvePlayer';
import { tr } from '../../i18n';

interface Defect {
  id: string;
  word: string;
  en: string;
  filters: Omit<FilterSpec, 'id'>[];
  text: string;
}

const DEFECTS: Defect[] = [
  { id: 'thin', word: tr("Magro"), en: 'thin / lean', filters: [{ type: 'lowshelf', freq: 220, gain: -7, q: 0.707 }], text: tr("Falta de graves e médios-graves: sem corpo, sem calor, impacto fraco.") },
  { id: 'boomy', word: tr("Retumbante"), en: 'boomy', filters: [{ type: 'peaking', freq: 130, gain: 7, q: 1.2 }], text: tr("Excesso em torno de 100–200 Hz: notas de baixo “ressoam” e parecem lentas, o bumbo vira um “bum” arredondado.") },
  { id: 'muddy', word: tr("Embolado"), en: 'muddy', filters: [{ type: 'peaking', freq: 350, gain: 6, q: 1 }], text: tr("Excesso em 250–500 Hz: tudo fica espesso e misturado, como se a música tocasse dentro de uma caixa.") },
  { id: 'boxy', word: tr("Anasalado"), en: 'honky / nasal', filters: [{ type: 'peaking', freq: 1000, gain: 6, q: 1.6 }], text: tr("Excesso perto de 1 kHz: vozes “pelo nariz”, som de buzina ou telefone.") },
  { id: 'shouty', word: tr("Gritado"), en: 'shouty', filters: [{ type: 'peaking', freq: 2200, gain: 6, q: 1.4 }], text: tr("Excesso em 1,5–3 kHz: vozes e guitarras “na cara”, agressivas; cansa rápido em volume alto.") },
  { id: 'harsh', word: tr("Áspero"), en: 'harsh', filters: [{ type: 'peaking', freq: 3800, gain: 6, q: 1.8 }], text: tr("Excesso em 3–5 kHz: estridência, aspereza em violinos e metais, fadiga auditiva.") },
  { id: 'sibilant', word: tr("Sibilante"), en: 'sibilant', filters: [{ type: 'peaking', freq: 7500, gain: 9, q: 4 }], text: tr("Pico estreito em 6–9 kHz: “s” e “ch” cortantes, pratos que chiam.") },
  { id: 'veiled', word: tr("Velado"), en: 'veiled / dark', filters: [{ type: 'highshelf', freq: 3000, gain: -7, q: 0.707 }], text: tr("Falta de presença e agudos: tudo soa distante, abafado, “atrás de uma cortina”.") },
  { id: 'airy', word: tr("Arejado"), en: 'airy', filters: [{ type: 'highshelf', freq: 11000, gain: 6, q: 0.707 }], text: tr("Mais energia acima de 10 kHz: abertura e brilho fino; sutil para muitos adultos.") },
  { id: 'scooped', word: tr("Médios recuados"), en: 'scooped / recessed mids', filters: [{ type: 'peaking', freq: 1500, gain: -7, q: 0.7 }], text: tr("Vale largo nos médios: vozes e instrumentos melódicos atrás de graves e agudos (assinatura em V).") },
];

export default function RegionBoostLab() {
  const [sel, setSel] = useState('boomy');
  const [amount, setAmount] = useState(1);
  const [on, setOn] = useState(true);
  const d = DEFECTS.find((x) => x.id === sel)!;
  const filters = useMemo<FilterSpec[]>(() => d.filters.map((f, i) => ({ ...f, id: `${d.id}${i}`, gain: f.gain * amount })), [d, amount]);
  const fn = useMemo(() => (f: number) => filtersDbAt(filters, f), [filters]);
  const { player } = useCurvePlayer('region-boost', fn, on);

  return (
    <LabFrame
      title={tr("Vocabulário dos defeitos")}
      description={tr("Cada palavra usada em reviews corresponde, aproximadamente, a um desvio de resposta em frequência. Escolha uma, ouça o efeito aplicado ao áudio e alterne com o original.")}
      audio
      onReset={() => {
        setSel('boomy');
        setAmount(1);
        setOn(true);
      }}
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {DEFECTS.map((x) => (
          <button
            key={x.id}
            onClick={() => setSel(x.id)}
            className={`text-[12.5px] px-2.5 py-1 rounded-lg border transition-colors ${sel === x.id ? 'border-accent text-fg bg-accent-soft' : 'border-line text-muted hover:text-fg'}`}
          >
            {x.word} <span className="text-faint">· {x.en}</span>
          </button>
        ))}
      </div>
      <FreqPlot height={220} dbMin={-12} dbMax={12} dbStep={4} curves={[{ id: 'd', label: d.word, fn, color: 'var(--c-a)', width: 2.4, fill: true }]} ariaLabel={tr("Desvio de resposta em frequência")} />
      <p className="mt-3 text-[14px] text-soft leading-relaxed">
        <strong className="text-fg">{d.word}.</strong> {d.text}
      </p>
      <div className="mt-4">
        <Controls cols={2}>
          <Slider label={tr("Intensidade do efeito")} value={amount} min={0} max={1.5} step={0.05} onChange={setAmount} format={(v) => `${Math.round(v * 100)}% (${fmtDb(d.filters[0].gain * v)})`} />
        </Controls>
      </div>
      <div className="mt-4">
        <SourceBar player={player} extra={<Toggle checked={on} onChange={setOn} label={on ? tr("Efeito ligado") : tr("Original")} />} />
      </div>
      <div className="mt-3">
        <Note>{tr("Alterne rapidamente entre efeito e original: diferenças de 2–3 dB em regiões largas são claras; picos estreitos são mais difíceis de notar com música e mais fáceis com ruído rosa. O nível é compensado automaticamente para que o efeito não soe apenas “mais alto”.")}</Note>
      </div>
    </LabFrame>
  );
}
