import { useMemo, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtDb, fmtHz, fmtNum } from '../../components/ui/controls';
import { SourceBar } from '../../components/ui/audio';
import { FILTER_LABEL } from '../../components/ui/FilterEditor';
import { FreqPlot } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb, qToOctaves, type FilterSpec, type FilterType } from '../../audio/dsp';
import { useBiquadChain } from '../../audio/useBiquadChain';
import { tr } from '../../i18n';

const TYPES: FilterType[] = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'];
const TEXT: Record<FilterType, string> = {
  peaking: 'Reforça ou atenua uma faixa em torno da frequência central, como um sino. O Q define a largura; o ganho, a altura. É o filtro mais usado para corrigir ressonâncias.',
  lowshelf: 'Eleva ou reduz tudo abaixo da frequência de corte, em degrau. É a ferramenta para ajustar a quantidade de graves (a curva Harman usa um shelf como este).',
  highshelf: 'Eleva ou reduz tudo acima da frequência de corte. Útil para inclinar o equilíbrio de agudos.',
  lowpass: 'Deixa passar as frequências abaixo do corte e atenua as de cima a 12 dB por oitava (2ª ordem). Com Q acima de 0,707 surge um pico antes do corte.',
  highpass: 'Deixa passar as frequências acima do corte. Remove graves e ruídos de baixa frequência.',
  notch: 'Remove uma faixa estreita, profundamente. Usado contra zumbidos e ressonâncias muito estreitas.',
  bandpass: 'Deixa passar só uma faixa em torno da frequência central. Útil para isolar regiões e ouvir o que está nelas.',
};

const D: FilterSpec = { id: 'x', type: 'peaking', freq: 1000, gain: 6, q: 1.4 };

/** Fase (graus) de um biquad. */
function phaseDeg(f: FilterSpec, fr: number, fs = 48000) {
  const c = biquadCoefs(f, fs);
  const w = (2 * Math.PI * fr) / fs;
  const nr = c.b0 + c.b1 * Math.cos(w) + c.b2 * Math.cos(2 * w);
  const ni = -(c.b1 * Math.sin(w) + c.b2 * Math.sin(2 * w));
  const dr = c.a0 + c.a1 * Math.cos(w) + c.a2 * Math.cos(2 * w);
  const di = -(c.a1 * Math.sin(w) + c.a2 * Math.sin(2 * w));
  return ((Math.atan2(ni, nr) - Math.atan2(di, dr)) * 180) / Math.PI;
}

export default function FilterLab() {
  const [f, setF] = useState<FilterSpec>(D);
  const [on, setOn] = useState(true);
  const [showPhase, setShowPhase] = useState(false);
  const filters = useMemo(() => [f], [f]);
  const player = useBiquadChain('filter', filters, { enabled: on, preampDb: Math.min(0, -Math.max(0, f.gain)) }, 'pink');
  const coefs = useMemo(() => biquadCoefs(f, 48000), [f]);
  const mag = (fr: number) => biquadDb(coefs, fr, 48000);

  const hasGain = f.type === 'peaking' || f.type === 'lowshelf' || f.type === 'highshelf';
  const hasQ = f.type !== 'lowshelf' && f.type !== 'highshelf';
  const bw = qToOctaves(f.q);

  return (
    <LabFrame
      title={tr("Explorador de filtros")}
      description={tr("Um único filtro biquad, com a resposta calculada pelas mesmas fórmulas que a Web Audio API usa para processar o áudio que você ouve.")}
      audio
      onReset={() => {
        setF(D);
        setOn(true);
      }}
      toolbar={<Segmented size="sm" value={f.type} onChange={(t) => setF((p) => ({ ...p, type: t, q: t === 'lowpass' || t === 'highpass' || t === 'lowshelf' || t === 'highshelf' ? 0.707 : p.q }))} options={TYPES.map((t) => ({ value: t, label: FILTER_LABEL[t] }))} />}
    >
      <FreqPlot
        height={260}
        dbMin={showPhase ? -180 : -24}
        dbMax={showPhase ? 180 : 15}
        dbStep={showPhase ? 45 : 3}
        yFormat={showPhase ? (v) => `${v}°` : undefined}
        curves={[showPhase ? { id: 'p', label: tr("Fase"), fn: (fr) => phaseDeg(f, fr), color: 'var(--c-target)', width: 2 } : { id: 'm', label: FILTER_LABEL[f.type], fn: mag, color: 'var(--c-a)', width: 2.6, fill: true }]}
        overlay={(sc) => <line x1={sc.x(f.freq)} x2={sc.x(f.freq)} y1={sc.top} y2={sc.top + sc.innerH} stroke="var(--fg-faint)" strokeDasharray="3 3" />}
        ariaLabel={tr("Resposta do filtro")}
      />
      <div className="mt-4">
        <Controls cols={3}>
          <Slider label={tr("Frequência")} value={f.freq} min={20} max={20000} log onChange={(v) => setF((p) => ({ ...p, freq: Math.round(v) }))} format={fmtHz} />
          <Slider label={tr("Ganho")} value={f.gain} min={-15} max={15} step={0.5} onChange={(v) => setF((p) => ({ ...p, gain: v }))} format={fmtDb} disabled={!hasGain} />
          <Slider label="Q" value={f.q} min={0.2} max={20} log onChange={(v) => setF((p) => ({ ...p, q: Number(v.toFixed(2)) }))} format={(v) => fmtNum(v, 2)} disabled={!hasQ} hint={!hasQ ? tr("Shelves com inclinação fixa (S = 1), como na Web Audio.") : undefined} />
        </Controls>
      </div>
      <div className="flex flex-wrap gap-4 mt-3">
        <Toggle checked={showPhase} onChange={setShowPhase} label={tr("Mostrar fase")} />
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("Largura (peak)"), value: f.type === 'peaking' || f.type === 'notch' || f.type === 'bandpass' ? tr("{0} oitava", fmtNum(bw, 2)) : '—' },
            { label: tr("Q ↔ largura"), value: `Q = ${fmtNum(f.q, 2)}` },
            { label: tr("Em {0}", fmtHz(f.freq)), value: fmtDb(mag(f.freq)), accent: true },
            { label: tr("Uma oitava acima"), value: fmtDb(mag(Math.min(20000, f.freq * 2))) },
          ]}
        />
      </div>
      <p className="mt-3 text-[13px] text-soft leading-relaxed">{TEXT[f.type]}</p>
      <div className="mt-4">
        <SourceBar player={player} extra={<Toggle checked={on} onChange={setOn} label={on ? tr("Filtro ligado") : tr("Original")} />} />
      </div>
      <div className="mt-3">
        <Note>{tr("Com fase visível, note que um filtro de EQ comum (“fase mínima”) altera a fase justamente onde altera a magnitude — e em nenhum outro lugar. Magnitude e fase andam juntas: é por isso que a EQ corrige também o comportamento temporal de uma ressonância.")}</Note>
      </div>
    </LabFrame>
  );
}
