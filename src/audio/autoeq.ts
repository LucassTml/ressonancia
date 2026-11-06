import { biquadCoefs, biquadDb, filtersDbAt, logFreqs, type FilterSpec } from './dsp';

export interface AutoEqOptions {
  count: number;
  fMin: number;
  fMax: number;
  maxGain: number;
  maxQ: number;
  /** usar um low shelf para os graves */
  bassShelf: boolean;
}

/**
 * Ajusta filtros paramétricos para aproximar `source` de `target`.
 * 1) posiciona filtros gulosamente no maior desvio restante (largura estimada
 *    pela meia altura do desvio); 2) refina todos os filtros por busca local,
 *    minimizando o erro quadrático ponderado. Reforços são limitados a
 *    `maxGain`, como em ferramentas reais, para proteger driver e headroom.
 */
export function autoEq(source: (f: number) => number, target: (f: number) => number, o: AutoEqOptions): FilterSpec[] {
  const freqs = logFreqs(160, o.fMin, o.fMax);
  // peso: menos importância acima de 8 kHz (medições menos confiáveis)
  const w = freqs.map((f) => (f > 8000 ? 0.35 : f < 40 ? 0.6 : 1));
  const err0 = freqs.map((f) => target(f) - source(f));
  // remove o deslocamento médio de 200 Hz–2 kHz (o volume é ajustado pelo preamp)
  const midIdx = freqs.map((f, i) => (f >= 200 && f <= 2000 ? i : -1)).filter((i) => i >= 0);
  const offset = midIdx.reduce((s, i) => s + err0[i], 0) / midIdx.length;
  const err = err0.map((e) => e - offset);

  const filters: FilterSpec[] = [];
  const residual = () => freqs.map((f, i) => err[i] - filtersDbAt(filters, f, 48000));
  // resposta de cada filtro em cache, para que a busca local seja rápida
  const respOf = (f: FilterSpec) => {
    const c = biquadCoefs(f, 48000);
    return freqs.map((fr) => biquadDb(c, fr, 48000));
  };
  const cost = (fl: FilterSpec[], cache?: number[][]) => {
    const rs = cache ?? fl.map(respOf);
    let c = 0;
    for (let i = 0; i < freqs.length; i++) {
      let s = 0;
      for (const r of rs) s += r[i];
      const e = err[i] - s;
      c += w[i] * e * e;
    }
    return c / freqs.length;
  };
  const clampF = (f: FilterSpec): FilterSpec => ({
    ...f,
    freq: Math.max(o.fMin, Math.min(o.fMax, f.freq)),
    gain: Math.max(-15, Math.min(o.maxGain, f.gain)),
    q: Math.max(0.4, Math.min(o.maxQ, f.q)),
  });

  if (o.bassShelf) {
    const bass = freqs.map((f, i) => (f < 90 ? err[i] : NaN)).filter((x) => !Number.isNaN(x));
    const g = bass.length ? bass.reduce((a, b) => a + b, 0) / bass.length : 0;
    if (Math.abs(g) > 0.5) filters.push(clampF({ id: 'ls', type: 'lowshelf', freq: 105, gain: g, q: 0.707 }));
  }

  while (filters.length < o.count) {
    const r = residual();
    let best = -1, bestV = 0;
    for (let i = 0; i < r.length; i++) {
      const v = Math.abs(r[i]) * w[i];
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    }
    if (best < 0 || bestV < 0.4) break;
    // largura: onde o desvio cai pela metade
    const half = r[best] / 2;
    let lo = best, hi = best;
    while (lo > 0 && Math.sign(r[lo]) === Math.sign(r[best]) && Math.abs(r[lo]) > Math.abs(half)) lo--;
    while (hi < r.length - 1 && Math.sign(r[hi]) === Math.sign(r[best]) && Math.abs(r[hi]) > Math.abs(half)) hi++;
    const bwOct = Math.max(0.1, Math.log2(freqs[hi] / freqs[lo]));
    const q = Math.sqrt(Math.pow(2, bwOct)) / (Math.pow(2, bwOct) - 1);
    filters.push(clampF({ id: `pk${filters.length}`, type: 'peaking', freq: freqs[best], gain: r[best], q }));
  }

  // refinamento local
  const cache = filters.map(respOf);
  let c = cost(filters, cache);
  for (let pass = 0; pass < 6; pass++) {
    for (let k = 0; k < filters.length; k++) {
      const f = filters[k];
      const cands: FilterSpec[] = [
        { ...f, freq: f.freq * 1.06 }, { ...f, freq: f.freq / 1.06 },
        { ...f, gain: f.gain + 0.3 }, { ...f, gain: f.gain - 0.3 },
        ...(f.type === 'peaking' ? [{ ...f, q: f.q * 1.12 }, { ...f, q: f.q / 1.12 }] : []),
      ].map(clampF);
      for (const cand of cands) {
        const old = cache[k];
        cache[k] = respOf(cand);
        const tc = cost(filters, cache);
        if (tc < c) {
          c = tc;
          filters[k] = cand;
        } else cache[k] = old;
      }
    }
  }
  return filters.map((f, i) => ({ ...f, id: `ae${i}`, freq: Math.round(f.freq), gain: Math.round(f.gain * 10) / 10, q: Math.round(f.q * 100) / 100, enabled: true }));
}

export function rmsError(a: (f: number) => number, b: (f: number) => number, fMin = 20, fMax = 10000) {
  const fs = logFreqs(120, fMin, fMax);
  const d = fs.map((f) => a(f) - b(f));
  const m = d.reduce((s, x) => s + x, 0) / d.length;
  return Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / d.length);
}
