import { useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, fmtHz, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';

type Cue = 'mistune' | 'onset' | 'vibrato';

const CUES: Record<Cue, { name: string; text: string }> = {
  mistune: {
    name: 'Harmonicidade',
    text: 'Desafine um único harmônico. Com 1–3% de desvio, ele “salta” e passa a ser ouvido como um tom separado. O cérebro agrupa componentes que pertencem à mesma série harmônica — e separa os que não pertencem.',
  },
  onset: {
    name: 'Início assíncrono',
    text: 'O harmônico escolhido começa alguns milissegundos antes dos outros. Mesmo perfeitamente afinado, ele tende a ser ouvido como outra fonte: componentes que começam juntos são agrupados como um único objeto.',
  },
  vibrato: {
    name: 'Destino comum',
    text: 'Os harmônicos de um mesmo som variam juntos. Aplique um vibrato independente a um harmônico e ele se destaca, como se fosse outro instrumento tocando na mesma região.',
  },
};

export default function MistunedLab() {
  const [cue, setCue] = useState<Cue>('mistune');
  const [f0, setF0] = useState(200);
  const [h, setH] = useState(4);
  const [amount, setAmount] = useState(4);
  const pb = usePlayback('mistuned');

  const play = () =>
    pb.start((ctx, out) => {
      const t = ctx.currentTime + 0.05;
      const dur = 1.6;
      const master = ctx.createGain();
      master.gain.value = dbToGain(-24);
      master.connect(out);
      const oscs: OscillatorNode[] = [];
      for (let k = 1; k <= 12; k++) {
        const o = ctx.createOscillator();
        let fr = f0 * k;
        if (k === h && cue === 'mistune') fr *= 1 + amount / 100;
        o.frequency.value = fr;
        const g = ctx.createGain();
        const level = 1 / Math.sqrt(k);
        const start = k === h && cue === 'onset' ? t - 0 : t + (cue === 'onset' ? amount * 0.012 : 0);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(level, start + 0.01);
        g.gain.setValueAtTime(level, t + dur);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
        if (k === h && cue === 'vibrato') {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 5.5;
          const lg = ctx.createGain();
          lg.gain.value = fr * (amount / 100) * 0.6;
          lfo.connect(lg).connect(o.frequency);
          lfo.start(t);
          lfo.stop(t + dur + 0.1);
          oscs.push(lfo);
        }
        o.connect(g).connect(master);
        o.start(Math.min(start, t));
        o.stop(t + dur + 0.1);
        oscs.push(o);
      }
      const id = window.setTimeout(() => pb.stop(), (dur + 0.3) * 1000);
      return () => {
        window.clearTimeout(id);
        oscs.forEach((o) => {
          try {
            o.stop();
          } catch {
            /* ok */
          }
        });
      };
    });

  const label = cue === 'mistune' ? 'Desafinação' : cue === 'onset' ? 'Antecipação' : 'Profundidade do vibrato';
  const unit = cue === 'onset' ? 'ms' : '%';
  const shown = cue === 'onset' ? amount * 12 : amount;

  return (
    <LabFrame
      title="Como o ouvido separa sons na mesma região"
      description="Um som complexo de 12 harmônicos, todos dentro da faixa dos médios. Três pistas que o sistema auditivo usa para decidir o que pertence a uma mesma fonte — e o que é outra fonte."
      audio
      onReset={() => {
        setCue('mistune');
        setF0(200);
        setH(4);
        setAmount(4);
      }}
      toolbar={<Segmented size="sm" value={cue} onChange={setCue} options={(Object.keys(CUES) as Cue[]).map((c) => ({ value: c, label: CUES[c].name }))} />}
      footer="Baseado em experimentos clássicos de análise de cenas auditivas: harmônicos desafinados (Moore, Glasberg e Peters, 1986), assincronia de início (Darwin) e modulação comum (Bregman). Use volume moderado; toque várias vezes, alternando com o efeito em zero."
    >
      <svg viewBox="0 0 480 120" className="w-full h-[140px]" aria-label="Harmônicos do som complexo">
        {Array.from({ length: 12 }, (_, i) => {
          const k = i + 1;
          const hh = (1 / Math.sqrt(k)) * 80;
          const sel = k === h;
          const shift = sel && cue === 'mistune' ? (amount / 100) * 40 * k * 0.4 : 0;
          return (
            <g key={k}>
              <rect x={16 + i * 38 + shift} y={96 - hh} width={20} height={hh} rx={3} fill={sel ? 'var(--c-b)' : 'var(--c-a)'} opacity={sel ? 1 : 0.7} style={{ transition: 'all .3s' }} />
              <text x={26 + i * 38} y={112} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px] tabular">
                {Math.round(f0 * k)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-3 mt-3 mb-4">
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : play())} label="Tocar" />
        <button className="text-[12.5px] text-muted hover:text-fg underline underline-offset-2" onClick={() => { setAmount(0); }}>
          zerar o efeito (referência)
        </button>
      </div>
      <Controls cols={3}>
        <Slider label="Fundamental" value={f0} min={100} max={400} step={10} onChange={setF0} format={fmtHz} />
        <Slider label="Harmônico alterado" value={h} min={2} max={10} step={1} onChange={setH} format={(v) => `${v}º (${fmtHz(v * f0)})`} />
        <Slider label={label} value={amount} min={0} max={cue === 'onset' ? 8 : 10} step={cue === 'onset' ? 0.25 : 0.25} onChange={setAmount} format={() => `${fmtNum(shown, cue === 'onset' ? 0 : 2)} ${unit}`} />
      </Controls>
      <p className="mt-4 text-[13.5px] text-soft leading-relaxed">{CUES[cue].text}</p>
      <div className="mt-4">
        <Readout
          items={[
            { label: 'Altura percebida do conjunto', value: fmtHz(f0) },
            { label: 'Frequência do harmônico alterado', value: fmtHz(h * f0 * (cue === 'mistune' ? 1 + amount / 100 : 1)), accent: true },
            { label: 'Todos os componentes entre', value: `${fmtHz(f0)} e ${fmtHz(12 * f0)}` },
          ]}
        />
      </div>
      <div className="mt-3">
        <Note>
          É assim que você distingue um violino de uma viola tocando juntos na mesma região: não pela faixa de frequência, mas por padrões
          — quais componentes são harmônicos entre si, quais começam juntos, quais variam juntos. Um fone ajuda quando preserva esses
          padrões: resposta equilibrada (sem mascarar componentes vizinhos), baixa distorção (sem criar componentes falsos) e boa igualdade
          entre os canais (para a pista espacial).
        </Note>
      </div>
    </LabFrame>
  );
}
