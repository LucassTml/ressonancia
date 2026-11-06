import { useEffect, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtNum } from '../../components/ui/controls';
import { SourceBar, useSourcePlayer } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';
import { useAnimationFrame } from '../../lib/hooks';

const PRESETS = {
  gentle: { threshold: -24, ratio: 2, knee: 10, attack: 20, release: 250, makeup: 4 },
  heavy: { threshold: -36, ratio: 8, knee: 4, attack: 5, release: 120, makeup: 12 },
  limiter: { threshold: -10, ratio: 20, knee: 0, attack: 1, release: 80, makeup: 6 },
};
type P = typeof PRESETS.gentle;

/** Curva estática de um compressor com joelho suave (forma usada pela Web Audio e pela literatura). */
function staticCurve(x: number, p: P) {
  const t = p.threshold, k = p.knee, r = p.ratio;
  if (2 * (x - t) < -k) return x;
  if (k > 0 && 2 * Math.abs(x - t) <= k) return x + ((1 / r - 1) * Math.pow(x - t + k / 2, 2)) / (2 * k);
  return t + (x - t) / r;
}

export default function DynamicsLab() {
  const [p, setP] = useState<P>(PRESETS.gentle);
  const [on, setOn] = useState(true);
  const [red, setRed] = useState(0);
  const comp = useRef<DynamicsCompressorNode | null>(null);
  const mk = useRef<{ wet: GainNode; dry: GainNode; mk: GainNode } | null>(null);
  const set = <K extends keyof P>(k: K, v: P[K]) => setP((x) => ({ ...x, [k]: v }));

  const player = useSourcePlayer('dynamics', (ctx, input, output) => {
    const c = ctx.createDynamicsCompressor();
    const mkG = ctx.createGain();
    const wet = ctx.createGain(), dry = ctx.createGain();
    wet.gain.value = on ? 1 : 0;
    dry.gain.value = on ? 0 : 1;
    const trim = ctx.createGain();
    trim.gain.value = 0.7;
    input.connect(trim);
    trim.connect(c).connect(mkG).connect(wet).connect(output);
    trim.connect(dry).connect(output);
    comp.current = c;
    mk.current = { wet, dry, mk: mkG };
    apply(c, mkG, p);
    return () => {
      comp.current = null;
      mk.current = null;
    };
  });

  function apply(c: DynamicsCompressorNode, g: GainNode, q: P) {
    const t = c.context.currentTime;
    c.threshold.setTargetAtTime(q.threshold, t, 0.01);
    c.ratio.setTargetAtTime(q.ratio, t, 0.01);
    c.knee.setTargetAtTime(q.knee, t, 0.01);
    c.attack.setTargetAtTime(q.attack / 1000, t, 0.01);
    c.release.setTargetAtTime(q.release / 1000, t, 0.01);
    g.gain.setTargetAtTime(dbToGain(q.makeup), t, 0.02);
  }

  useEffect(() => {
    if (comp.current && mk.current) apply(comp.current, mk.current.mk, p);
  }, [p]);
  useEffect(() => {
    const m = mk.current;
    if (!m) return;
    const t = m.wet.context.currentTime;
    m.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.015);
    m.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.015);
  }, [on]);

  useAnimationFrame(() => {
    if (comp.current) setRed(comp.current.reduction);
  }, player.playing);

  const S = 220, pad = 26;
  const X = (db: number) => pad + ((db + 60) / 60) * (S - pad - 6);
  const Y = (db: number) => S - pad - ((db + 60) / 60) * (S - pad - 6);
  let path = '';
  for (let x = -60; x <= 0; x += 0.5) path += `${x === -60 ? 'M' : 'L'}${X(x).toFixed(1)},${Y(Math.max(-60, Math.min(0, staticCurve(x, p) + p.makeup))).toFixed(1)}`;

  return (
    <LabFrame
      title="Compressão e limitação"
      description="Um compressor reduz o ganho quando o sinal passa de um limiar, na proporção definida pela razão. Ajuste os parâmetros, veja a curva estática e ouça o efeito sobre a dinâmica da música."
      audio
      onReset={() => setP(PRESETS.gentle)}
      toolbar={
        <Segmented
          size="sm"
          value={p === PRESETS.gentle ? 'gentle' : p === PRESETS.heavy ? 'heavy' : p === PRESETS.limiter ? 'limiter' : ''}
          onChange={(v) => setP(PRESETS[v as keyof typeof PRESETS])}
          options={[
            { value: 'gentle', label: 'Suave' },
            { value: 'heavy', label: 'Pesado' },
            { value: 'limiter', label: 'Limitador' },
          ]}
        />
      }
      footer="Processamento com o DynamicsCompressorNode da Web Audio API, que mede o nível de pico e aplica um joelho suave e um pequeno atraso de antecipação (lookahead). O medidor mostra a redução de ganho aplicada em tempo real."
    >
      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
        <div>
          <svg width={S} height={S} className="rounded-xl bg-sunken block" aria-label="Curva estática do compressor">
            {[-60, -40, -20, 0].map((d) => (
              <g key={d}>
                <line x1={X(d)} x2={X(d)} y1={6} y2={S - pad} stroke="var(--c-grid)" />
                <line x1={pad} x2={S - 6} y1={Y(d)} y2={Y(d)} stroke="var(--c-grid)" />
                <text x={X(d)} y={S - 10} textAnchor="middle" className="fill-[var(--fg-faint)] text-[9px]">{d}</text>
                <text x={pad - 4} y={Y(d) + 3} textAnchor="end" className="fill-[var(--fg-faint)] text-[9px]">{d}</text>
              </g>
            ))}
            <line x1={X(-60)} y1={Y(-60)} x2={X(0)} y2={Y(0)} stroke="var(--fg-faint)" strokeDasharray="3 3" />
            <line x1={X(p.threshold)} x2={X(p.threshold)} y1={6} y2={S - pad} stroke="var(--c-b)" strokeDasharray="2 3" />
            <path d={path} fill="none" stroke="var(--c-a)" strokeWidth={2.4} />
            <text x={S / 2} y={S - 1} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">entrada (dB)</text>
          </svg>
          <div className="mt-3">
            <div className="text-[11.5px] text-muted mb-1">Redução de ganho agora</div>
            <div className="h-2.5 rounded-full bg-sunken overflow-hidden w-[220px]">
              <div className="h-full bg-[var(--c-b)] transition-[width] duration-75" style={{ width: `${Math.min(100, (-red / 30) * 100)}%` }} />
            </div>
            <div className="text-[12px] font-mono tabular text-fg mt-1">{fmtNum(red, 1)} dB</div>
          </div>
        </div>
        <div>
          <Controls cols={2}>
            <Slider label="Limiar (threshold)" value={p.threshold} min={-60} max={0} step={1} onChange={(v) => set('threshold', v)} unit="dB" />
            <Slider label="Razão (ratio)" value={p.ratio} min={1} max={20} step={0.5} onChange={(v) => set('ratio', v)} format={(v) => `${fmtNum(v, 1)}:1`} />
            <Slider label="Joelho (knee)" value={p.knee} min={0} max={40} step={1} onChange={(v) => set('knee', v)} unit="dB" />
            <Slider label="Ataque" value={p.attack} min={0} max={100} step={1} onChange={(v) => set('attack', v)} unit="ms" />
            <Slider label="Liberação (release)" value={p.release} min={10} max={1000} log onChange={(v) => set('release', Math.round(v))} unit="ms" />
            <Slider label="Ganho de compensação" value={p.makeup} min={0} max={20} step={0.5} onChange={(v) => set('makeup', v)} unit="dB" />
          </Controls>
          <div className="mt-4">
            <Readout
              items={[
                { label: 'Acima do limiar, cada 10 dB de entrada viram', value: `${fmtNum(10 / p.ratio, 1)} dB` },
                { label: 'Redução da faixa dinâmica (acima do limiar)', value: `${fmtNum((1 - 1 / p.ratio) * 100, 0)}%`, accent: true },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="mt-5">
        <SourceBar player={player} extra={<Toggle checked={on} onChange={setOn} label={on ? 'Compressor ligado' : 'Original'} />} />
      </div>
      <div className="mt-3">
        <Note>
          Compressão não muda a resposta em frequência: muda o <em>tempo</em> — quanto os picos sobressaem da média. Com ataque rápido, os
          transientes perdem impacto; com liberação rápida e razão alta, surge o “bombeamento” (o volume sobe e desce com o bumbo). É o
          processo por trás da guerra do volume.
        </Note>
      </div>
    </LabFrame>
  );
}
