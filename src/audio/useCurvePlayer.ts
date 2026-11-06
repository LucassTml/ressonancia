import { useEffect, useMemo, useRef } from 'react';
import { useSourcePlayer, type SourceKind } from '../components/ui/audio';
import { firBuffer, logFreqs } from './dsp';
import { dbToGain } from './engine';

/**
 * Reproduz uma fonte de áudio através de um filtro FIR de fase mínima que
 * aplica a curva `dbFn` (em dB). Oferece comutação instantânea entre o sinal
 * processado e o original, e um preamp automático que evita clipping:
 * o ganho é reduzido pelo maior reforço da curva, tanto no processado quanto
 * no original — assim a comparação acontece com o mesmo nível de referência.
 */
export function useCurvePlayer(name: string, dbFn: (f: number) => number, processed: boolean, defaultSource: SourceKind = 'music') {
  const maxBoost = useMemo(() => {
    let m = 0;
    for (const f of logFreqs(200, 20, 20000)) m = Math.max(m, dbFn(f));
    return m;
  }, [dbFn]);

  const refs = useRef<{ conv: ConvolverNode; wet: GainNode; dry: GainNode; pre: GainNode } | null>(null);
  const state = useRef({ processed, maxBoost });
  state.current = { processed, maxBoost };

  const player = useSourcePlayer(
    name,
    (ctx, input, output) => {
      const pre = ctx.createGain();
      pre.gain.value = dbToGain(-state.current.maxBoost);
      const conv = ctx.createConvolver();
      conv.normalize = false;
      conv.buffer = firBuffer(ctx, dbFn);
      const wet = ctx.createGain();
      const dry = ctx.createGain();
      wet.gain.value = state.current.processed ? 1 : 0;
      dry.gain.value = state.current.processed ? 0 : 1;
      input.connect(pre);
      pre.connect(conv).connect(wet).connect(output);
      pre.connect(dry).connect(output);
      refs.current = { conv, wet, dry, pre };
      return () => {
        refs.current = null;
      };
    },
    defaultSource,
  );

  // atualiza o filtro quando a curva muda (com leve atraso para não recalcular a cada pixel de arraste)
  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const id = window.setTimeout(() => {
      const rr = refs.current;
      if (!rr) return;
      rr.conv.buffer = firBuffer(rr.conv.context, dbFn);
      rr.pre.gain.setTargetAtTime(dbToGain(-maxBoost), rr.pre.context.currentTime, 0.03);
    }, 40);
    return () => window.clearTimeout(id);
  }, [dbFn, maxBoost]);

  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const t = r.wet.context.currentTime;
    r.wet.gain.setTargetAtTime(processed ? 1 : 0, t, 0.015);
    r.dry.gain.setTargetAtTime(processed ? 0 : 1, t, 0.015);
  }, [processed]);

  return { player, preampDb: -maxBoost };
}
