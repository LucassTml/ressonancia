import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Note } from '../../components/ui/LabFrame';
import { Button, Segmented, Slider, fmtHz } from '../../components/ui/controls';
import { PlayButton, usePlayback } from '../../components/ui/audio';
import { dbToGain } from '../../audio/engine';
import { useElementSize } from '../../lib/hooks';

const N = 16;
type Preset = { id: string; name: string; amps: number[]; note: string };
const mk = (f: (n: number) => number) => Array.from({ length: N }, (_, i) => f(i + 1));

const PRESETS: Preset[] = [
  { id: 'sine', name: 'Senoide', amps: mk((n) => (n === 1 ? 1 : 0)), note: 'Apenas a fundamental. Soa “puro”, quase sem caráter — raro na natureza.' },
  { id: 'square', name: 'Quadrada', amps: mk((n) => (n % 2 ? 1 / n : 0)), note: 'Só harmônicos ímpares, com amplitude 1/n. Som oco e “eletrônico”, parente do clarinete.' },
  { id: 'saw', name: 'Dente de serra', amps: mk((n) => 1 / n), note: 'Todos os harmônicos com amplitude 1/n. Brilhante e áspero, base de sintetizadores de cordas e metais.' },
  { id: 'tri', name: 'Triangular', amps: mk((n) => (n % 2 ? 1 / (n * n) : 0)), note: 'Ímpares caindo com 1/n²: tão fracos que o som fica suave, perto de uma senoide.' },
  { id: 'clar', name: 'Tipo clarinete', amps: [1, 0.04, 0.75, 0.05, 0.5, 0.06, 0.32, 0.04, 0.2, 0.05, 0.12, 0.03, 0.08, 0.02, 0.05, 0.02], note: 'Tubo cilíndrico fechado numa ponta: ímpares dominam nos registros graves.' },
  { id: 'nasal', name: 'Nasal (tipo oboé)', amps: [0.35, 0.8, 1, 0.75, 0.55, 0.3, 0.25, 0.15, 0.12, 0.08, 0.06, 0.05, 0.04, 0.03, 0.02, 0.02], note: 'Harmônicos 2–5 mais fortes que a fundamental, como um formante fixo. A altura percebida continua sendo a da fundamental.' },
  { id: 'organ', name: 'Órgão (registros)', amps: [1, 0.8, 0.6, 0.5, 0, 0.4, 0, 0.35, 0, 0, 0, 0.2, 0, 0, 0, 0.15], note: 'Somas de tubos em oitavas e quintas, como os registros de um órgão de tubos.' },
  { id: 'even', name: 'Só pares + fundamental', amps: mk((n) => (n === 1 ? 1 : n % 2 ? 0 : 0.6 / n)), note: 'Pares reforçam oitavas da fundamental; soam “consonantes” e encorpam o som — o tipo de distorção associado a certos amplificadores valvulados.' },
];

export default function HarmonicsLab() {
  const [amps, setAmps] = useState<number[]>(PRESETS[2].amps);
  const [preset, setPreset] = useState('saw');
  const [f0, setF0] = useState(220);
  const [env, setEnv] = useState<'sustain' | 'pluck' | 'bow'>('pluck');
  const pb = usePlayback('harmonics');
  const live = useRef<{ osc: OscillatorNode; ctx: AudioContext } | null>(null);
  const [svgWrap, { width }] = useElementSize<HTMLDivElement>();
  const dragging = useRef(false);

  const norm = useMemo(() => {
    // normaliza pelo pico da forma de onda para manter nível seguro
    let peak = 0;
    for (let i = 0; i < 512; i++) {
      const t = i / 512;
      let v = 0;
      amps.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * (k + 1) * t)));
      peak = Math.max(peak, Math.abs(v));
    }
    return peak || 1;
  }, [amps]);

  const wavePath = useMemo(() => {
    const W = 600, H = 120;
    let d = '';
    for (let i = 0; i <= 400; i++) {
      const t = (i / 400) * 2;
      let v = 0;
      amps.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * (k + 1) * t)));
      d += `${i ? 'L' : 'M'}${((i / 400) * W).toFixed(1)},${(H / 2 - (v / norm) * (H / 2 - 6)).toFixed(1)}`;
    }
    return d;
  }, [amps, norm]);

  const makeWave = (ctx: BaseAudioContext) => {
    const real = new Float32Array(N + 1);
    const imag = new Float32Array(N + 1);
    amps.forEach((a, k) => (imag[k + 1] = a));
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  };

  useEffect(() => {
    const l = live.current;
    if (!l) return;
    l.osc.setPeriodicWave(makeWave(l.ctx));
    l.osc.frequency.setTargetAtTime(f0, l.ctx.currentTime, 0.01);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amps, f0]);

  const play = (single: boolean) =>
    pb.start((ctx, out) => {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(makeWave(ctx));
      osc.frequency.value = f0;
      const g = ctx.createGain();
      const lvl = dbToGain(-20);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      const e = single ? env : 'sustain';
      if (e === 'pluck') {
        g.gain.linearRampToValueAtTime(lvl, t + 0.004);
        g.gain.setTargetAtTime(0, t + 0.01, 0.45);
      } else if (e === 'bow') {
        g.gain.linearRampToValueAtTime(lvl, t + 0.35);
        g.gain.setValueAtTime(lvl, t + 1.4);
        g.gain.linearRampToValueAtTime(0, t + 1.9);
      } else g.gain.linearRampToValueAtTime(lvl, t + 0.04);
      osc.connect(g).connect(out);
      osc.start();
      live.current = { osc, ctx };
      let timer = 0;
      if (single) timer = window.setTimeout(() => pb.stop(), 2200);
      return () => {
        window.clearTimeout(timer);
        const tt = ctx.currentTime;
        g.gain.cancelScheduledValues(tt);
        g.gain.setValueAtTime(g.gain.value, tt);
        g.gain.linearRampToValueAtTime(0, tt + 0.04);
        setTimeout(() => osc.stop(), 60);
        live.current = null;
      };
    });

  const barW = width ? Math.min(34, (width - 8) / N) : 24;
  const H = 150;
  const setFromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const k = Math.floor(x / barW);
    if (k < 0 || k >= N) return;
    const v = Math.max(0, Math.min(1, 1 - (y - 6) / (H - 26)));
    setAmps((a) => a.map((old, i) => (i === k ? Math.round(v * 100) / 100 : old)));
    setPreset('');
  };

  const p = PRESETS.find((x) => x.id === preset);

  return (
    <LabFrame
      title="Sintetizador de harmônicos"
      description="Síntese aditiva exata: o som tocado é a soma dos harmônicos desenhados, gerada por uma PeriodicWave. Arraste as barras para criar timbres."
      audio
      onReset={() => {
        setAmps(PRESETS[2].amps);
        setPreset('saw');
        setF0(220);
      }}
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PRESETS.map((pr) => (
          <button
            key={pr.id}
            onClick={() => {
              setAmps(pr.amps);
              setPreset(pr.id);
            }}
            className={`text-[12.5px] px-2.5 py-1 rounded-lg border transition-colors ${
              preset === pr.id ? 'border-accent text-fg bg-accent-soft' : 'border-line text-muted hover:text-fg hover:border-line-strong'
            }`}
          >
            {pr.name}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <div ref={svgWrap}>
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">Espectro — amplitude de cada harmônico</div>
          <svg
            width={barW * N}
            height={H}
            className="touch-none cursor-ns-resize block"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setFromPointer(e);
            }}
            onPointerMove={(e) => dragging.current && setFromPointer(e)}
            onPointerUp={() => (dragging.current = false)}
            role="img"
            aria-label="Barras de amplitude dos harmônicos"
          >
            {amps.map((a, k) => {
              const h = a * (H - 26);
              return (
                <g key={k}>
                  <rect x={k * barW + 2} y={6} width={barW - 4} height={H - 26} rx={3} fill="var(--bg-sunken)" />
                  <rect
                    x={k * barW + 2}
                    y={6 + (H - 26) - h}
                    width={barW - 4}
                    height={h}
                    rx={3}
                    fill={k === 0 ? 'var(--accent)' : 'var(--c-a)'}
                    opacity={k === 0 ? 1 : 0.75}
                    style={{ transition: 'y .18s cubic-bezier(.22,1,.36,1), height .18s cubic-bezier(.22,1,.36,1)' }}
                  />
                  <text x={k * barW + barW / 2} y={H - 6} textAnchor="middle" className="fill-[var(--fg-muted)] text-[10px] tabular">
                    {k + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="text-[11.5px] text-faint mt-1">
            Harmônico n = n × {fmtHz(f0)} · o 16º está em {fmtHz(16 * f0)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">Forma de onda — dois períodos</div>
          <svg viewBox="0 0 600 120" className="w-full h-[150px] rounded-lg bg-sunken" preserveAspectRatio="none" aria-label="Forma de onda resultante">
            <line x1="0" x2="600" y1="60" y2="60" stroke="var(--c-grid-strong)" />
            <line x1="300" x2="300" y1="0" y2="120" stroke="var(--c-grid)" />
            <path d={wavePath} fill="none" stroke="var(--fg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : play(false))} label="Tom contínuo" />
        <Button onClick={() => play(true)}>Tocar nota</Button>
        <Segmented
          size="sm"
          value={env}
          onChange={setEnv}
          options={[
            { value: 'pluck', label: 'Envelope dedilhado' },
            { value: 'bow', label: 'Envelope arco/sopro' },
            { value: 'sustain', label: 'Sem envelope' },
          ]}
        />
      </div>
      <Controls cols={2}>
        <Slider label="Frequência fundamental" value={f0} min={55} max={880} log onChange={(v) => setF0(Math.round(v))} format={fmtHz} />
      </Controls>
      <div className="mt-3">
        <Note>
          {p ? p.note : 'Timbre personalizado.'} Experimente o mesmo espectro com envelopes diferentes: o ataque é tão importante para o
          reconhecimento de instrumentos quanto os harmônicos.
        </Note>
      </div>
    </LabFrame>
  );
}
