import { useEffect, useMemo, useRef, useState } from 'react';
import { LabFrame, Controls, Note } from '../../components/ui/LabFrame';
import { Segmented, Slider, Toggle, fmtDb, fmtHz } from '../../components/ui/controls';
import { PlayButton, usePlayback, fadeGain } from '../../components/ui/audio';
import { FreqPlot, Legend } from '../../viz/FreqPlot';
import { biquadCoefs, biquadDb } from '../../audio/dsp';
import { dbToGain, demoMusicBuffer, decodeFile } from '../../audio/engine';

const D = { level: -8, cutoff: 700, delay: 0.3, on: true };

/** Buffer de teste: instrumentos totalmente à esquerda e à direita, alternados. */
function hardPanBuffer(ctx: BaseAudioContext) {
  const sr = ctx.sampleRate, len = sr * 4;
  const b = ctx.createBuffer(2, len, sr);
  const L = b.getChannelData(0), R = b.getChannelData(1);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const beat = Math.floor(t * 4);
    const ph = t * 4 - beat;
    const env = Math.exp(-ph * 6);
    const f = beat % 2 ? 392 : 523.25;
    const v = env * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t)) * 0.35;
    if (beat % 2) R[i] = v;
    else L[i] = v;
  }
  return b;
}

export default function CrossfeedLab() {
  const [s, setS] = useState(D);
  const set = <K extends keyof typeof D>(k: K, v: (typeof D)[K]) => setS((p) => ({ ...p, [k]: v }));
  const [src, setSrc] = useState<'pan' | 'music' | 'file'>('pan');
  const [file, setFile] = useState<AudioBuffer | null>(null);
  const pb = usePlayback('crossfeed');
  const n = useRef<{ lpL: BiquadFilterNode; lpR: BiquadFilterNode; dL: DelayNode; dR: DelayNode; gL: GainNode; gR: GainNode; dirL: GainNode; dirR: GainNode } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const x = n.current;
    if (!x) return;
    const t = x.lpL.context.currentTime;
    for (const lp of [x.lpL, x.lpR]) lp.frequency.setTargetAtTime(s.cutoff, t, 0.02);
    for (const d of [x.dL, x.dR]) d.delayTime.setTargetAtTime(s.delay / 1000, t, 0.02);
    for (const g of [x.gL, x.gR]) g.gain.setTargetAtTime(s.on ? dbToGain(s.level) : 0, t, 0.02);
    const dg = s.on ? 1 / (1 + dbToGain(s.level) * 0.5) : 1;
    for (const g of [x.dirL, x.dirR]) g.gain.setTargetAtTime(dg, t, 0.02);
  }, [s]);

  const start = async (which = src, fileBuf = file) => {
    const music = which === 'music' ? await demoMusicBuffer(48000) : null;
    pb.start((ctx, out) => {
      const f = fadeGain(ctx, out, 1);
      const sNode = ctx.createBufferSource();
      sNode.buffer = which === 'pan' ? hardPanBuffer(ctx) : which === 'music' ? music : fileBuf;
      sNode.loop = true;
      const split = ctx.createChannelSplitter(2);
      const merge = ctx.createChannelMerger(2);
      sNode.connect(split);
      const mk = () => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = s.cutoff;
        lp.Q.value = 20 * Math.log10(0.6);
        const d = ctx.createDelay(0.01);
        d.delayTime.value = s.delay / 1000;
        const g = ctx.createGain();
        g.gain.value = s.on ? dbToGain(s.level) : 0;
        return { lp, d, g };
      };
      const a = mk(), b = mk();
      const dirL = ctx.createGain(), dirR = ctx.createGain();
      const dg = s.on ? 1 / (1 + dbToGain(s.level) * 0.5) : 1;
      dirL.gain.value = dirR.gain.value = dg;
      // direto
      split.connect(dirL, 0).connect(merge, 0, 0);
      split.connect(dirR, 1).connect(merge, 0, 1);
      // cruzado: L → R e R → L, filtrado e atrasado
      split.connect(a.lp, 0);
      a.lp.connect(a.d).connect(a.g).connect(merge, 0, 1);
      split.connect(b.lp, 1);
      b.lp.connect(b.d).connect(b.g).connect(merge, 0, 0);
      merge.connect(f.node);
      sNode.start();
      n.current = { lpL: a.lp, lpR: b.lp, dL: a.d, dR: b.d, gL: a.g, gR: b.g, dirL, dirR };
      return () => f.release(() => {
        sNode.stop();
        n.current = null;
      });
    });
  };

  const lpc = useMemo(() => biquadCoefs({ id: 'lp', type: 'lowpass', freq: s.cutoff, gain: 0, q: 0.6 }, 48000), [s.cutoff]);
  const cross = (f: number) => (s.on ? s.level + biquadDb(lpc, f, 48000) : -60);
  const direct = () => (s.on ? 20 * Math.log10(1 / (1 + dbToGain(s.level) * 0.5)) : 0);

  return (
    <LabFrame
      title="Crossfeed"
      description="Em caixas de som, cada ouvido também ouve a caixa do lado oposto, atrasada e com menos agudos (a cabeça faz sombra). O crossfeed imita isso: mistura em cada canal uma cópia filtrada e atrasada do outro. Use fones."
      audio
      onReset={() => setS(D)}
      footer="Implementação simples no espírito dos circuitos de Bauer (1961) e de crossfeeds digitais: passa-baixas de 2ª ordem, atraso de ~0,3 ms (a diferença de chegada entre os ouvidos para caixas a ±30°) e ganho ajustável. O caminho direto é levemente reduzido para manter o volume."
    >
      <FreqPlot
        height={220}
        dbMin={-30}
        dbMax={3}
        dbStep={6}
        curves={[
          { id: 'd', label: 'Caminho direto (mesmo lado)', fn: direct, color: 'var(--c-a)', width: 2.2 },
          { id: 'c', label: 'Caminho cruzado (lado oposto)', fn: cross, color: 'var(--c-b)', width: 2.2 },
        ]}
        ariaLabel="Respostas dos caminhos do crossfeed"
      />
      <div className="mt-2 mb-4">
        <Legend items={[{ label: 'Direto', color: 'var(--c-a)' }, { label: 'Cruzado', color: 'var(--c-b)' }]} />
      </div>
      <Controls cols={3}>
        <Slider label="Nível do cruzamento" value={s.level} min={-18} max={-3} step={0.5} onChange={(v) => set('level', v)} format={fmtDb} />
        <Slider label="Corte do passa-baixas" value={s.cutoff} min={300} max={2000} log onChange={(v) => set('cutoff', Math.round(v))} format={fmtHz} />
        <Slider label="Atraso" value={s.delay} min={0} max={0.8} step={0.01} onChange={(v) => set('delay', v)} unit="ms" />
      </Controls>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <PlayButton playing={pb.playing} onToggle={() => (pb.playing ? pb.stop() : void start())} />
        <Segmented
          size="sm"
          value={src}
          onChange={(v) => {
            if (v === 'file' && !file) {
              inputRef.current?.click();
              return;
            }
            setSrc(v);
            if (pb.playing) void start(v);
          }}
          options={[
            { value: 'pan', label: 'Teste: pan extremo' },
            { value: 'music', label: 'Música demo' },
            { value: 'file', label: file ? 'Seu arquivo' : 'Abrir arquivo…' },
          ]}
        />
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const fl = e.target.files?.[0];
            if (!fl) return;
            const b = await decodeFile(fl);
            setFile(b);
            setSrc('file');
            void start('file', b);
          }}
        />
        <Toggle checked={s.on} onChange={(v) => set('on', v)} label={s.on ? 'Crossfeed ligado' : 'Desligado'} />
      </div>
      <div className="mt-3">
        <Note>
          No teste de pan extremo, as notas saem só de um ouvido de cada vez — algo que nunca acontece com caixas. Com crossfeed, elas se
          aproximam do centro e a sensação de “som colado no ouvido” diminui. Não espere externalização: o som continua dentro da cabeça,
          mas fica mais confortável em gravações antigas com pan radical.
        </Note>
      </div>
    </LabFrame>
  );
}
