/**
 * Matemática de processamento de sinais usada pelos laboratórios.
 * As fórmulas dos biquads seguem o "Audio EQ Cookbook" (R. Bristow-Johnson),
 * que é exatamente o que a especificação da Web Audio API implementa — então
 * o gráfico desenhado corresponde ao filtro realmente aplicado ao áudio.
 */

export type FilterType = 'peaking' | 'lowshelf' | 'highshelf' | 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface FilterSpec {
  id: string;
  type: FilterType;
  freq: number;
  gain: number; // dB (peaking/shelf)
  q: number; // Q linear (shelves usam inclinação fixa S=1 ⇔ Q≈0,707 na Web Audio)
  enabled?: boolean;
}

export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

export const SHELF_Q = Math.SQRT1_2;

export function biquadCoefs(f: FilterSpec, fs: number): Biquad {
  const w0 = (2 * Math.PI * Math.min(f.freq, fs * 0.499)) / fs;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const A = Math.pow(10, f.gain / 40);
  const q = Math.max(0.05, f.q);
  const alpha = sin / (2 * q);
  switch (f.type) {
    case 'peaking':
      return { b0: 1 + alpha * A, b1: -2 * cos, b2: 1 - alpha * A, a0: 1 + alpha / A, a1: -2 * cos, a2: 1 - alpha / A };
    case 'lowshelf': {
      const al = (sin / 2) * Math.SQRT2; // S = 1
      const s = 2 * Math.sqrt(A) * al;
      return {
        b0: A * (A + 1 - (A - 1) * cos + s),
        b1: 2 * A * (A - 1 - (A + 1) * cos),
        b2: A * (A + 1 - (A - 1) * cos - s),
        a0: A + 1 + (A - 1) * cos + s,
        a1: -2 * (A - 1 + (A + 1) * cos),
        a2: A + 1 + (A - 1) * cos - s,
      };
    }
    case 'highshelf': {
      const al = (sin / 2) * Math.SQRT2;
      const s = 2 * Math.sqrt(A) * al;
      return {
        b0: A * (A + 1 + (A - 1) * cos + s),
        b1: -2 * A * (A - 1 + (A + 1) * cos),
        b2: A * (A + 1 + (A - 1) * cos - s),
        a0: A + 1 - (A - 1) * cos + s,
        a1: 2 * (A - 1 - (A + 1) * cos),
        a2: A + 1 - (A - 1) * cos - s,
      };
    }
    case 'lowpass':
      return { b0: (1 - cos) / 2, b1: 1 - cos, b2: (1 - cos) / 2, a0: 1 + alpha, a1: -2 * cos, a2: 1 - alpha };
    case 'highpass':
      return { b0: (1 + cos) / 2, b1: -(1 + cos), b2: (1 + cos) / 2, a0: 1 + alpha, a1: -2 * cos, a2: 1 - alpha };
    case 'bandpass':
      return { b0: alpha, b1: 0, b2: -alpha, a0: 1 + alpha, a1: -2 * cos, a2: 1 - alpha };
    case 'notch':
      return { b0: 1, b1: -2 * cos, b2: 1, a0: 1 + alpha, a1: -2 * cos, a2: 1 - alpha };
  }
}

/** Magnitude em dB do biquad na frequência f. */
export function biquadDb(c: Biquad, f: number, fs: number) {
  const w = (2 * Math.PI * f) / fs;
  const cw = Math.cos(w), sw = Math.sin(w);
  const c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = c.b0 + c.b1 * cw + c.b2 * c2;
  const ni = -(c.b1 * sw + c.b2 * s2);
  const dr = c.a0 + c.a1 * cw + c.a2 * c2;
  const di = -(c.a1 * sw + c.a2 * s2);
  const mag2 = (nr * nr + ni * ni) / (dr * dr + di * di);
  return 10 * Math.log10(Math.max(mag2, 1e-20));
}

export function filtersDbAt(filters: FilterSpec[], f: number, fs = 48000) {
  let sum = 0;
  for (const flt of filters) {
    if (flt.enabled === false) continue;
    sum += biquadDb(biquadCoefs(flt, fs), f, fs);
  }
  return sum;
}

/** Aplica um FilterSpec num BiquadFilterNode, convertendo o Q quando necessário. */
export function configureNode(node: BiquadFilterNode, f: FilterSpec, ctx: BaseAudioContext, smooth = 0.015) {
  const t = ctx.currentTime;
  if (node.type !== f.type) node.type = f.type;
  const enabled = f.enabled !== false;
  const gain = enabled ? f.gain : 0;
  node.frequency.setTargetAtTime(f.freq, t, smooth);
  node.gain.setTargetAtTime(gain, t, smooth);
  // Na Web Audio, o Q de lowpass/highpass é expresso em dB.
  const q = f.type === 'lowpass' || f.type === 'highpass' ? 20 * Math.log10(f.q) : f.q;
  node.Q.setTargetAtTime(q, t, smooth);
}

/** Largura de banda em oitavas equivalente a um Q (definição do cookbook para peaking). */
export function qToOctaves(q: number) {
  return (2 / Math.LN2) * Math.asinh(1 / (2 * q));
}

/* ------------------------------------------------------------------ */
/* Frequências e curvas                                                */
/* ------------------------------------------------------------------ */

/** Vetor de frequências log-espaçadas. */
export function logFreqs(n = 256, fMin = 20, fMax = 20000) {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = fMin * Math.pow(fMax / fMin, i / (n - 1));
  return out;
}

export type Curve = [number, number][]; // [freq, dB]

/** Interpolação linear em log-frequência; extrapola mantendo as pontas. */
export function interpCurve(curve: Curve, f: number) {
  const n = curve.length;
  if (f <= curve[0][0]) return curve[0][1];
  if (f >= curve[n - 1][0]) return curve[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (curve[mid][0] > f) hi = mid;
    else lo = mid;
  }
  const [f0, d0] = curve[lo];
  const [f1, d1] = curve[hi];
  const t = Math.log(f / f0) / Math.log(f1 / f0);
  return d0 + (d1 - d0) * t;
}

/** Interpolação suave (Catmull-Rom monotônica em log f) entre nós de controle. */
export function smoothNodes(nodes: Curve, f: number) {
  const n = nodes.length;
  if (f <= nodes[0][0]) return nodes[0][1];
  if (f >= nodes[n - 1][0]) return nodes[n - 1][1];
  const x = Math.log(f);
  let i = 0;
  while (i < n - 2 && Math.log(nodes[i + 1][0]) < x) i++;
  const xs = nodes.map((p) => Math.log(p[0]));
  const ys = nodes.map((p) => p[1]);
  // tangentes de Fritsch-Carlson
  const m = (k: number) => {
    if (k <= 0) return (ys[1] - ys[0]) / (xs[1] - xs[0]);
    if (k >= n - 1) return (ys[n - 1] - ys[n - 2]) / (xs[n - 1] - xs[n - 2]);
    const d0 = (ys[k] - ys[k - 1]) / (xs[k] - xs[k - 1]);
    const d1 = (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
    if (d0 * d1 <= 0) return 0;
    return (2 * d0 * d1) / (d0 + d1);
  };
  const h = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / h;
  const t2 = t * t, t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i] +
    (t3 - 2 * t2 + t) * h * m(i) +
    (-2 * t3 + 3 * t2) * ys[i + 1] +
    (t3 - t2) * h * m(i + 1)
  );
}

/** Suavização fracionária de oitava (média em janela log). */
export function smoothCurve(curve: Curve, fraction = 6): Curve {
  const half = Math.pow(2, 1 / (2 * fraction));
  return curve.map(([f]) => {
    const lo = f / half, hi = f * half;
    let s = 0, c = 0;
    for (const [ff, d] of curve) {
      if (ff >= lo && ff <= hi) {
        s += d;
        c++;
      }
    }
    return [f, c ? s / c : interpCurve(curve, f)];
  });
}

export function sampleFn(fn: (f: number) => number, freqs = logFreqs(300)): Curve {
  return freqs.map((f) => [f, fn(f)]);
}

/** Normaliza uma curva para 0 dB numa frequência de referência. */
export function normalizeAt(curve: Curve, fRef = 1000): Curve {
  const off = interpCurve(curve, fRef);
  return curve.map(([f, d]) => [f, d - off]);
}

/* ------------------------------------------------------------------ */
/* FFT e FIR de fase mínima                                            */
/* ------------------------------------------------------------------ */

/** FFT radix-2 in-place (re, im). Direção: 1 direta, −1 inversa (sem normalização). */
export function fft(re: Float64Array, im: Float64Array, dir: 1 | -1 = 1) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI * dir) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/**
 * Constrói um filtro FIR de fase mínima a partir de uma magnitude desejada
 * (em dB, função da frequência) pelo método do cepstro real (homomórfico).
 * Fase mínima é a escolha fisicamente coerente: é o comportamento de um
 * sistema acústico simples como um fone, sem "pré-eco".
 */
export function minPhaseFir(dbAt: (f: number) => number, fs: number, n = 4096): Float32Array<ArrayBuffer> {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k <= n / 2; k++) {
    const f = Math.max(10, (k * fs) / n);
    const db = Math.max(-60, Math.min(30, dbAt(Math.min(f, 22000))));
    re[k] = (db / 20) * Math.LN10; // ln|H|
    if (k > 0 && k < n / 2) re[n - k] = re[k];
  }
  fft(re, im, -1); // cepstro real
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] = 0;
  }
  // dobra o cepstro: componentes causais dobradas, anticausais zeradas
  for (let i = 1; i < n / 2; i++) {
    re[i] *= 2;
    re[n - i] = 0;
  }
  fft(re, im, 1);
  // exp complexo
  for (let i = 0; i < n; i++) {
    const m = Math.exp(re[i]);
    const ph = im[i];
    re[i] = m * Math.cos(ph);
    im[i] = m * Math.sin(ph);
  }
  fft(re, im, -1);
  const out = new Float32Array(n);
  const fadeStart = Math.floor(n * 0.75);
  for (let i = 0; i < n; i++) {
    let v = re[i] / n;
    if (i > fadeStart) v *= 0.5 * (1 + Math.cos((Math.PI * (i - fadeStart)) / (n - fadeStart)));
    out[i] = v;
  }
  return out;
}

/** Cria um AudioBuffer de resposta ao impulso para um ConvolverNode. */
export function firBuffer(ctx: BaseAudioContext, dbAt: (f: number) => number, n = 4096) {
  const ir = minPhaseFir(dbAt, ctx.sampleRate, n);
  const buf = ctx.createBuffer(2, ir.length, ctx.sampleRate);
  buf.copyToChannel(ir, 0);
  buf.copyToChannel(ir, 1);
  return buf;
}

/** Espectro de magnitude (dB) de um bloco real, com janela de Hann. */
export function magnitudeSpectrum(x: Float32Array | number[], n = 4096) {
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const len = Math.min(n, x.length);
  let wsum = 0;
  for (let i = 0; i < len; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (len - 1)));
    re[i] = x[i] * w;
    wsum += w;
  }
  fft(re, im, 1);
  const out = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    const mag = (2 * Math.hypot(re[k], im[k])) / wsum;
    out[k] = 20 * Math.log10(Math.max(mag, 1e-12));
  }
  return out;
}
