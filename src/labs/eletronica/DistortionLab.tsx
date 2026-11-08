import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Readout, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtNum } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { dbToGain, demoMusicBuffer } from '../../audio/engine';
import { magnitudeSpectrum } from '../../audio/dsp';
import { useElementSize } from '../../lib/hooks';
import { tr } from '../../i18n';

type Kind = 'clean' | 'ss-clip' | 'tube-se' | 'tube-pp' | 'crossover';

const KINDS: Record<Kind, { name: string; text: string }> = {
  clean: { name: tr("Linear (ideal)"), text: tr("Saída proporcional à entrada até o limite da fonte. Sem harmônicos adicionados.") },
  'ss-clip': { name: tr("Transistor com realimentação"), text: tr("Muito linear até o limite da alimentação; ali, corta abruptamente (clipping duro), gerando harmônicos ímpares fortes e de ordem alta. Com folga de tensão, a distorção é desprezível.") },
  'tube-se': { name: tr("Válvula single-ended"), text: tr("Curva de transferência assimétrica e suave: comprime um semiciclo mais que o outro. Gera principalmente 2º harmônico, que cresce gradualmente com o nível.") },
  'tube-pp': { name: tr("Válvulas em push-pull"), text: tr("Duas válvulas em contrafase cancelam os harmônicos pares; sobra uma compressão simétrica e suave, dominada pelo 3º harmônico.") },
  crossover: { name: tr("Classe B mal polarizada"), text: tr("Uma pequena “zona morta” perto de zero, onde um transistor desliga antes do outro ligar. Distorção que piora em volume BAIXO — rica em harmônicos ímpares altos e notoriamente desagradável.") },
};

/** Curvas de transferência (entrada −1..1 → saída). */
function transfer(kind: Kind, x: number, drive: number) {
  const u = x * drive;
  switch (kind) {
    case 'clean':
      return Math.max(-1, Math.min(1, u));
    case 'ss-clip':
      return Math.max(-0.95, Math.min(0.95, u));
    case 'tube-se': {
      // assimetria: o lado positivo satura mais cedo e mais suavemente
      const k = 0.35;
      return u >= 0 ? Math.tanh(u * (1 + k)) / (1 + k) * 1.05 : Math.tanh(u * (1 - k * 0.6)) / (1 - k * 0.6) * 0.95;
    }
    case 'tube-pp':
      return Math.tanh(u * 1.2) / 1.2;
    case 'crossover': {
      const dz = 0.06;
      const v = Math.abs(u) < dz ? 0 : u - Math.sign(u) * dz;
      return Math.max(-1, Math.min(1, v * 1.07));
    }
  }
}

function makeCurve(kind: Kind, drive: number, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = transfer(kind, (i / (n - 1)) * 2 - 1, drive);
  return c;
}

export default function DistortionLab() {
  const [kind, setKind] = useState<Kind>('tube-se');
  const [drive, setDrive] = useState(1.6);
  const [level, setLevel] = useState(0.7);
  const [src, setSrc] = useState<'sine' | 'music'>('sine');
  const [bypass, setBypass] = useState(false);
  const pb = usePlayback('distortion');
  const shaper = useRef<WaveShaperNode | null>(null);
  const inGain = useRef<GainNode | null>(null);
  const [wrap, { width }] = useElementSize<HTMLDivElement>();

  // Análise numérica: uma senoide de 1 kHz passa pela curva e calcula-se o espectro
  const analysis = useMemo(() => {
    const fs = 48000, f = 1000, n = 4096;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = transfer(kind, level * Math.sin((2 * Math.PI * f * i) / fs), drive);
    const spec = magnitudeSpectrum(x, n);
    const bin = (fr: number) => Math.round((fr * n) / fs);
    const harm = Array.from({ length: 9 }, (_, k) => {
      let m = -200;
      const b = bin(f * (k + 1));
      for (let j = b - 2; j <= b + 2; j++) m = Math.max(m, spec[j]);
      return m;
    });
    const fund = Math.pow(10, harm[0] / 20);
    const hsum = harm.slice(1).reduce((s, d) => s + Math.pow(10, d / 10), 0);
    const thd = Math.sqrt(hsum) / fund;
    const wave = Array.from(x.slice(0, 144));
    return { harm: harm.map((d) => d - harm[0]), thd, wave };
  }, [kind, drive, level]);

  useEffect(() => {
    if (shaper.current) shaper.current.curve = bypass ? makeCurve('clean', 1) : makeCurve(kind, drive);
    if (inGain.current) inGain.current.gain.setTargetAtTime(level, inGain.current.context.currentTime, 0.02);
  }, [kind, drive, level, bypass]);

  const start = async () => {
    const buf = src === 'music' ? await demoMusicBuffer(48000) : null;
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, dbToGain(-10));
      const g = ctx.createGain();
      g.gain.value = level;
      const ws = ctx.createWaveShaper();
      ws.curve = bypass ? makeCurve('clean', 1) : makeCurve(kind, drive);
      ws.oversample = '4x';
      let node: AudioScheduledSourceNode;
      if (src === 'sine') {
        const o = ctx.createOscillator();
        o.frequency.value = 440;
        node = o;
      } else {
        const s = ctx.createBufferSource();
        s.buffer = buf!;
        s.loop = true;
        node = s;
      }
      node.connect(g).connect(ws).connect(f.node);
      node.start();
      shaper.current = ws;
      inGain.current = g;
      return () => f.release(() => {
        node.stop();
        shaper.current = null;
        inGain.current = null;
      });
    });
  };

  const W = width || 300;
  const TS = 150;
  const curvePath = (() => {
    let d = '';
    for (let i = 0; i <= 100; i++) {
      const x = (i / 100) * 2 - 1;
      const y = transfer(kind, x, drive);
      d += `${i ? 'L' : 'M'}${(((x + 1) / 2) * TS).toFixed(1)},${((1 - (y + 1) / 2) * TS).toFixed(1)}`;
    }
    return d;
  })();
  const waveW = Math.max(120, W - TS - 260);

  return (
    <LabFrame
      title={tr("Distorção: válvula, transistor e cruzamento")}
      description={tr("Cada tipo de amplificador se afasta da linha reta de um jeito. A curva de transferência mostra como; o espectro mostra quais harmônicos aparecem; e você pode ouvir o resultado aplicado a um tom ou à música.")}
      audio
      onReset={() => {
        setKind('tube-se');
        setDrive(1.6);
        setLevel(0.7);
      }}
      toolbar={<Segmented size="sm" value={kind} onChange={setKind} options={(Object.keys(KINDS) as Kind[]).map((k) => ({ value: k, label: KINDS[k].name }))} />}
      footer={tr("Curvas de transferência estilizadas, que reproduzem o perfil de harmônicos típico de cada topologia. Amplificadores reais têm comportamento dependente da frequência, da carga e do nível. A análise usa uma senoide de 1 kHz processada numericamente e uma FFT de 4096 pontos.")}
    >
      <div ref={wrap} className="flex flex-wrap gap-4 items-start">
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">{tr("Transferência")}</div>
          <svg width={TS} height={TS} className="rounded-lg bg-sunken block" aria-label={tr("Curva de transferência")}>
            <line x1={0} y1={TS} x2={TS} y2={0} stroke="var(--c-grid-strong)" strokeDasharray="3 3" />
            <line x1={TS / 2} y1={0} x2={TS / 2} y2={TS} stroke="var(--c-grid)" />
            <line x1={0} y1={TS / 2} x2={TS} y2={TS / 2} stroke="var(--c-grid)" />
            <rect x={((1 - level) / 2) * TS} y={0} width={level * TS} height={TS} fill="var(--accent-soft)" />
            <path d={curvePath} fill="none" stroke="var(--c-a)" strokeWidth={2.2} />
          </svg>
        </div>
        <div className="flex-1 min-w-[140px]">
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">{tr("Forma de onda (1 kHz)")}</div>
          <svg viewBox={`0 0 ${waveW} ${TS}`} width="100%" height={TS} preserveAspectRatio="none" className="rounded-lg bg-sunken block">
            <line x1={0} x2={waveW} y1={TS / 2} y2={TS / 2} stroke="var(--c-grid)" />
            <path
              d={analysis.wave.map((v, i) => `${i ? 'L' : 'M'}${((i / (analysis.wave.length - 1)) * waveW).toFixed(1)},${(TS / 2 - v * (TS / 2 - 6)).toFixed(1)}`).join('')}
              fill="none"
              stroke="var(--fg)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="w-[240px]">
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint font-medium mb-1">{tr("Harmônicos (relativos à fundamental)")}</div>
          <svg width={240} height={TS} className="rounded-lg bg-sunken block" aria-label={tr("Espectro de harmônicos")}>
            {[0, -40, -80, -120].map((d) => (
              <g key={d}>
                <line x1={22} x2={236} y1={8 + (-d / 120) * (TS - 26)} y2={8 + (-d / 120) * (TS - 26)} stroke="var(--c-grid)" />
                <text x={20} y={11 + (-d / 120) * (TS - 26)} textAnchor="end" className="fill-[var(--fg-faint)] text-[8.5px]">{d}</text>
              </g>
            ))}
            {analysis.harm.map((d, k) => {
              const h = Math.max(0, (120 + Math.max(-120, d)) / 120) * (TS - 26);
              return (
                <g key={k}>
                  <rect x={28 + k * 23} y={8 + (TS - 26) - h} width={14} height={h} rx={2} fill={k === 0 ? 'var(--fg-muted)' : k % 2 ? 'var(--c-b)' : 'var(--c-a)'} style={{ transition: 'all .25s' }} />
                  <text x={35 + k * 23} y={TS - 6} textAnchor="middle" className="fill-[var(--fg-muted)] text-[9px]">{k + 1}</text>
                </g>
              );
            })}
          </svg>
          <div className="flex gap-3 text-[10.5px] text-muted mt-1">
            <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--c-a)] mr-1" />{tr("pares")}</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--c-b)] mr-1" />{tr("ímpares")}</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Controls cols={2}>
          <Slider label={tr("Nível do sinal na entrada")} value={level} min={0.02} max={1} log onChange={(v) => setLevel(Number(v.toFixed(3)))} format={(v) => `${fmtNum(20 * Math.log10(v), 1)} dB`} hint={tr("Repare como a distorção de cruzamento piora em nível baixo e a das outras curvas, em nível alto.")} />
          <Slider label={tr("Ganho do estágio (quanto se aproxima da saturação)")} value={drive} min={0.5} max={5} step={0.05} onChange={setDrive} format={(v) => `${fmtNum(v, 2)}×`} />
        </Controls>
      </div>
      <div className="mt-4">
        <Readout
          items={[
            { label: tr("THD"), value: analysis.thd < 1e-5 ? '< 0,001%' : `${fmtNum(analysis.thd * 100, analysis.thd < 0.01 ? 3 : 2)}%`, accent: true },
            { label: tr("THD em dB"), value: analysis.thd < 1e-5 ? tr("< −100 dB") : `${fmtNum(20 * Math.log10(analysis.thd), 1)} dB` },
            { label: tr("2º harmônico"), value: `${fmtNum(Math.max(-140, analysis.harm[1]), 1)} dB` },
            { label: tr("3º harmônico"), value: `${fmtNum(Math.max(-140, analysis.harm[2]), 1)} dB` },
          ]}
        />
      </div>
      <p className="mt-3 text-[13px] text-soft leading-relaxed">{KINDS[kind].text}</p>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : void start())} />
        <Segmented size="sm" value={src} onChange={(v) => { setSrc(v); pb.stop(); }} options={[{ value: 'sine', label: tr("Tom de 440 Hz") }, { value: 'music', label: tr("Música demo") }]} />
        <Toggle checked={bypass} onChange={setBypass} label={tr("Sem distorção (comparar)")} />
      </div>
      <div className="mt-3">
        <Note>{tr("Com a mesma THD, o 2º harmônico (uma oitava acima) costuma ser muito menos incômodo que harmônicos ímpares de ordem alta, que caem longe da fundamental e não são mascarados por ela. Por isso o número de THD, sozinho, diz pouco sobre o quanto uma distorção é audível.")}</Note>
      </div>
    </LabFrame>
  );
}
