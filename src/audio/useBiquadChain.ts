import { useEffect, useRef } from 'react';
import { useSourcePlayer, type SourceKind } from '../components/ui/audio';
import { configureNode, type FilterSpec } from './dsp';
import { dbToGain } from './engine';

/**
 * O sinal chega ao WaveShaper atenuado 4× (−12 dB); a curva devolve o ganho.
 * Com o teto ligado, a curva satura em ±1 — o equivalente a 0 dBFS do sinal
 * original. Desligado, é linear até +12 dB acima de 0 dBFS.
 */
function ceilingCurve(clip: boolean) {
  const c = new Float32Array(2049);
  for (let i = 0; i < c.length; i++) {
    const v = ((i / (c.length - 1)) * 2 - 1) * 4;
    c[i] = clip ? Math.max(-1, Math.min(1, v)) : v;
  }
  return c;
}

export interface ChainTaps {
  pre: AnalyserNode;
  post: AnalyserNode;
}

/**
 * Cadeia real de BiquadFilterNodes da Web Audio API, atualizada em tempo real.
 * fonte → preamp → filtros → [teto digital opcional] → saída
 * Os analisadores “pre” e “post” permitem ver o espectro antes e depois da EQ.
 */
export function useBiquadChain(
  name: string,
  filters: FilterSpec[],
  opts: { enabled: boolean; preampDb: number; hardClip?: boolean; onTaps?: (t: ChainTaps | null) => void; onClip?: () => void },
  defaultSource: SourceKind = 'music',
) {
  const nodes = useRef<{ ctx: AudioContext; pre: GainNode; biquads: BiquadFilterNode[]; dry: GainNode; wet: GainNode; head: GainNode; tail: GainNode; clipper: WaveShaperNode; post: AnalyserNode; preAn: AnalyserNode } | null>(null);
  const state = useRef({ filters, opts });
  state.current = { filters, opts };

  const build = (ctx: AudioContext, head: GainNode, tail: GainNode, fl: FilterSpec[]) => {
    const biquads = fl.map((f) => {
      const b = ctx.createBiquadFilter();
      configureNode(b, f, ctx, 0);
      b.type = f.type;
      b.frequency.value = f.freq;
      b.gain.value = f.enabled === false ? 0 : f.gain;
      b.Q.value = f.type === 'lowpass' || f.type === 'highpass' ? 20 * Math.log10(f.q) : f.q;
      return b;
    });
    let prev: AudioNode = head;
    for (const b of biquads) {
      prev.connect(b);
      prev = b;
    }
    prev.connect(tail);
    return biquads;
  };

  const player = useSourcePlayer(
    name,
    (ctx, input, output) => {
      const { filters: fl, opts: o } = state.current;
      const preAn = ctx.createAnalyser();
      preAn.fftSize = 8192;
      preAn.smoothingTimeConstant = 0.75;
      const pre = ctx.createGain();
      pre.gain.value = dbToGain(o.preampDb);
      const head = ctx.createGain();
      const tail = ctx.createGain();
      const wet = ctx.createGain();
      const dry = ctx.createGain();
      wet.gain.value = o.enabled ? 1 : 0;
      dry.gain.value = o.enabled ? 0 : 1;
      const clipper = ctx.createWaveShaper();
      clipper.curve = ceilingCurve(!!o.hardClip);
      const post = ctx.createAnalyser();
      post.fftSize = 8192;
      post.smoothingTimeConstant = 0.75;
      // A pré-amplificação e o teto digital agem dos dois lados da comparação
      // (o original também passa pelo preamp), para comparar no mesmo nível.
      input.connect(preAn);
      input.connect(pre);
      pre.connect(head);
      pre.connect(dry);
      const biquads = build(ctx, head, tail, fl);
      tail.connect(wet);
      const sum = ctx.createGain();
      sum.gain.value = 0.25;
      wet.connect(sum);
      dry.connect(sum);
      sum.connect(clipper).connect(post).connect(output);
      nodes.current = { ctx, pre, biquads, dry, wet, head, tail, clipper, post, preAn };
      o.onTaps?.({ pre: preAn, post });
      // monitor de clipping (amostras acima do teto antes do clipper)
      const probe = ctx.createAnalyser();
      probe.fftSize = 1024;
      sum.connect(probe);
      const buf = new Float32Array(probe.fftSize);
      const id = window.setInterval(() => {
        probe.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        if (peak * 4 >= 0.999) state.current.opts.onClip?.();
      }, 60);
      return () => {
        window.clearInterval(id);
        nodes.current = null;
        state.current.opts.onTaps?.(null);
      };
    },
    defaultSource,
  );

  // atualiza filtros: reconfigura in place; se a quantidade mudou, reconstrói só o trecho de filtros
  useEffect(() => {
    const n = nodes.current;
    if (!n) return;
    if (n.biquads.length === filters.length) {
      filters.forEach((f, i) => configureNode(n.biquads[i], f, n.ctx));
    } else {
      n.head.disconnect();
      n.biquads.forEach((b) => b.disconnect());
      n.biquads = build(n.ctx, n.head, n.tail, filters);
    }
  }, [filters]);

  useEffect(() => {
    const n = nodes.current;
    if (!n) return;
    const t = n.ctx.currentTime;
    n.wet.gain.setTargetAtTime(opts.enabled ? 1 : 0, t, 0.015);
    n.dry.gain.setTargetAtTime(opts.enabled ? 0 : 1, t, 0.015);
    n.pre.gain.setTargetAtTime(dbToGain(opts.preampDb), t, 0.02);
  }, [opts.enabled, opts.preampDb]);

  useEffect(() => {
    const n = nodes.current;
    if (!n) return;
    n.clipper.curve = ceilingCurve(!!opts.hardClip);
  }, [opts.hardClip]);

  return player;
}
