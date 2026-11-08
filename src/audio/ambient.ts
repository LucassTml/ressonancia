import { createPersistentStore } from '../lib/storage';
import { getAudio, pinkNoiseBuffer, playingOwnerStore, whiteNoiseBuffer } from './engine';

/**
 * Som de fundo para leitura. Tudo é sintetizado no navegador: não há arquivos
 * de áudio. Cada camada tem volume próprio; o conjunto silencia sozinho
 * enquanto qualquer experimento do site estiver tocando.
 */

export type LayerId = 'white' | 'pink' | 'brown' | 'rain' | 'ocean' | 'wind' | 'stream' | 'fire' | 'birds' | 'night' | 'piano' | 'pads' | 'lofi';
export type LayerGroup = 'noise' | 'nature' | 'music';

export interface AmbientState {
  on: boolean;
  master: number;
  levels: Partial<Record<LayerId, number>>;
}

export const LAYERS: { id: LayerId; group: LayerGroup }[] = [
  { id: 'white', group: 'noise' },
  { id: 'pink', group: 'noise' },
  { id: 'brown', group: 'noise' },
  { id: 'rain', group: 'nature' },
  { id: 'ocean', group: 'nature' },
  { id: 'wind', group: 'nature' },
  { id: 'stream', group: 'nature' },
  { id: 'fire', group: 'nature' },
  { id: 'birds', group: 'nature' },
  { id: 'night', group: 'nature' },
  { id: 'piano', group: 'music' },
  { id: 'pads', group: 'music' },
  { id: 'lofi', group: 'music' },
];

export const AMBIENT_PRESETS: { id: string; levels: Partial<Record<LayerId, number>> }[] = [
  { id: 'focus', levels: { brown: 0.6 } },
  { id: 'rainpiano', levels: { rain: 0.55, piano: 0.5 } },
  { id: 'beach', levels: { ocean: 0.7, wind: 0.15 } },
  { id: 'cabin', levels: { fire: 0.6, piano: 0.35 } },
  { id: 'forest', levels: { birds: 0.5, stream: 0.4, wind: 0.2 } },
  { id: 'nightp', levels: { night: 0.5, pads: 0.3 } },
  { id: 'lofirain', levels: { lofi: 0.6, rain: 0.25 } },
];

// nunca liga sozinho ao abrir a página: `on` é sempre falso no carregamento
export const ambientStore = createPersistentStore<AmbientState>('ambient', { on: false, master: 0.5, levels: { rain: 0.55, piano: 0.5 } });
if (ambientStore.get().on) ambientStore.set((s) => ({ ...s, on: false }));

interface Running {
  gain: GainNode;
  stop: () => void;
}

let bus: GainNode | null = null;
let reverb: ConvolverNode | null = null;
const running = new Map<LayerId, Running>();
const cache = new Map<string, AudioBuffer>();

const rand = (a = 1, b = 0) => b + Math.random() * (a - b);

function ensureBus(ctx: AudioContext) {
  if (bus) return bus;
  bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(ctx.destination);
  return bus;
}

/** Reverberação sintética (ruído com decaimento) para as camadas musicais. */
function getReverb(ctx: AudioContext) {
  if (reverb) return reverb;
  const len = Math.floor(ctx.sampleRate * 3.2);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (0.5 - 0.42 * x);
      d[i] = lp * Math.pow(1 - x, 3) * 0.6;
    }
  }
  reverb = ctx.createConvolver();
  reverb.buffer = ir;
  reverb.connect(ensureBus(ctx));
  return reverb;
}

function cached(ctx: BaseAudioContext, key: string, seconds: number, fill: (L: Float32Array, R: Float32Array, sr: number) => void) {
  const k = `${key}-${ctx.sampleRate}`;
  let b = cache.get(k);
  if (b) return b;
  const n = Math.floor(ctx.sampleRate * seconds);
  b = ctx.createBuffer(2, n, ctx.sampleRate);
  fill(b.getChannelData(0), b.getChannelData(1), ctx.sampleRate);
  // emenda suave do loop
  const fade = Math.floor(ctx.sampleRate * 0.2);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < fade; i++) {
      const u = i / fade;
      d[n - fade + i] = d[n - fade + i] * (1 - u) + d[i] * u;
    }
  }
  cache.set(k, b);
  return b;
}

function brownBuffer(ctx: BaseAudioContext) {
  return cached(ctx, 'brown', 8, (L, R) => {
    for (const d of [L, R]) {
      let v = 0;
      for (let i = 0; i < d.length; i++) {
        v = (v + (Math.random() * 2 - 1) * 0.02) / 1.02;
        d[i] = v * 3.2;
      }
    }
  });
}

/** Grãos curtos espalhados no estéreo: base de chuva, riacho e estalos. */
function addGrain(L: Float32Array, R: Float32Array, at: number, len: number, pan: number, gen: (i: number, n: number) => number) {
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < len && at + i < L.length; i++) {
    const v = gen(i, len);
    L[at + i] += v * gl;
    R[at + i] += v * gr;
  }
}

function loopNode(ctx: AudioContext, buf: AudioBuffer) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start(0, Math.random() * buf.duration);
  return s;
}

/** Oscilador lento que varia um parâmetro em torno de seu valor. */
function lfo(ctx: AudioContext, target: AudioParam, freq: number, depth: number) {
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g).connect(target);
  o.start();
  return o;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Cria os nós de uma camada; devolve a função que para tudo. */
function buildLayer(id: LayerId, ctx: AudioContext, out: GainNode): () => void {
  const stoppers: (AudioScheduledSourceNode | { stop: () => void })[] = [];
  const stopAll = () =>
    stoppers.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* já parado */
      }
    });

  if (id === 'white' || id === 'pink' || id === 'brown') {
    const buf = id === 'white' ? whiteNoiseBuffer(ctx) : id === 'pink' ? pinkNoiseBuffer(ctx) : brownBuffer(ctx);
    const trim = ctx.createGain();
    trim.gain.value = id === 'white' ? 0.3 : id === 'pink' ? 0.5 : 0.8;
    const s = loopNode(ctx, buf);
    s.connect(trim).connect(out);
    stoppers.push(s);
  } else if (id === 'rain') {
    const bed = loopNode(ctx, pinkNoiseBuffer(ctx));
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    const g = ctx.createGain();
    g.gain.value = 0.45;
    bed.connect(hp).connect(lp).connect(g).connect(out);
    const drops = cached(ctx, 'drops', 12, (L, R, sr) => {
      for (let k = 0; k < 7000; k++) {
        const len = Math.floor(sr * rand(0.012, 0.003));
        const f = rand(5200, 1400);
        const a = Math.pow(Math.random(), 3) * 0.32;
        addGrain(L, R, Math.floor(Math.random() * (L.length - len)), len, rand(1, -1), (i, n) => Math.sin((2 * Math.PI * f * i) / sr) * Math.exp((-5 * i) / n) * a);
      }
    });
    const d = loopNode(ctx, drops);
    d.connect(out);
    stoppers.push(bed, d);
  } else if (id === 'ocean') {
    for (const [pan, rate] of [[-0.6, 0.083], [0.6, 0.107], [0, 0.061]] as const) {
      const s = loopNode(ctx, pinkNoiseBuffer(ctx));
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = 0.32;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      s.connect(lp).connect(g).connect(p).connect(out);
      stoppers.push(s, lfo(ctx, g.gain, rate, 0.26), lfo(ctx, lp.frequency, rate, 650));
    }
  } else if (id === 'wind') {
    const s = loopNode(ctx, pinkNoiseBuffer(ctx));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    s.connect(bp).connect(g).connect(out);
    stoppers.push(s, lfo(ctx, bp.frequency, 0.07, 240), lfo(ctx, bp.frequency, 0.19, 90), lfo(ctx, g.gain, 0.11, 0.35));
  } else if (id === 'stream') {
    const bubbles = cached(ctx, 'bubbles', 14, (L, R, sr) => {
      for (let k = 0; k < 3200; k++) {
        const dur = rand(0.06, 0.012);
        const len = Math.floor(sr * dur);
        const f0 = rand(2400, 500);
        const up = rand(1.5, 1.05);
        const a = Math.pow(Math.random(), 2) * 0.2;
        let ph = 0;
        addGrain(L, R, Math.floor(Math.random() * (L.length - len)), len, rand(0.9, -0.9), (i, n) => {
          ph += (2 * Math.PI * f0 * (1 + (up - 1) * (i / n))) / sr;
          return Math.sin(ph) * Math.sin((Math.PI * i) / n) * a;
        });
      }
    });
    const s = loopNode(ctx, bubbles);
    const bed = loopNode(ctx, pinkNoiseBuffer(ctx));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    bed.connect(bp).connect(g).connect(out);
    s.connect(out);
    stoppers.push(s, bed);
  } else if (id === 'fire') {
    const rumble = loopNode(ctx, brownBuffer(ctx));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.6;
    rumble.connect(lp).connect(g).connect(out);
    const crack = cached(ctx, 'crackle', 16, (L, R, sr) => {
      for (let k = 0; k < 1100; k++) {
        const len = Math.floor(sr * rand(0.02, 0.002));
        const a = Math.pow(Math.random(), 4) * 0.9;
        addGrain(L, R, Math.floor(Math.random() * (L.length - len)), len, rand(0.7, -0.7), (i, n) => (Math.random() * 2 - 1) * Math.exp((-7 * i) / n) * a);
      }
    });
    const c = loopNode(ctx, crack);
    c.connect(out);
    stoppers.push(rumble, c, lfo(ctx, g.gain, 0.23, 0.14));
  } else if (id === 'birds') {
    const song = cached(ctx, 'birds', 26, (L, R, sr) => {
      for (let b = 0; b < 26; b++) {
        let at = Math.floor(Math.random() * (L.length - sr * 2));
        const base = rand(5200, 2300);
        const pan = rand(0.9, -0.9);
        const a = rand(0.16, 0.04);
        const notes = Math.floor(rand(7, 2));
        const shape = rand(1.5, -0.6);
        for (let n = 0; n < notes; n++) {
          const len = Math.floor(sr * rand(0.16, 0.05));
          const f = base * rand(1.2, 0.85);
          let ph = 0;
          addGrain(L, R, at, len, pan, (i, m) => {
            const u = i / m;
            ph += (2 * Math.PI * f * (1 + shape * 0.25 * u + 0.04 * Math.sin(u * 40))) / sr;
            return Math.sin(ph) * Math.pow(Math.sin(Math.PI * u), 1.5) * a;
          });
          at += len + Math.floor(sr * rand(0.1, 0.02));
        }
      }
    });
    const s = loopNode(ctx, song);
    s.connect(out);
    stoppers.push(s);
  } else if (id === 'night') {
    const crickets = cached(ctx, 'crickets', 10, (L, R, sr) => {
      for (const [pan, f, rate, a] of [[-0.7, 4300, 2.1, 0.07], [0.6, 4850, 2.6, 0.055], [0.1, 3900, 1.7, 0.04]] as const) {
        const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
        const per = Math.round(L.length / Math.round((L.length / sr) * rate));
        for (let i = 0; i < L.length; i++) {
          const u = (i % per) / per;
          const trill = u < 0.42 ? Math.pow(Math.sin(i * ((2 * Math.PI * 34) / sr)), 2) * Math.sin((Math.PI * u) / 0.42) : 0;
          const v = Math.sin((2 * Math.PI * f * i) / sr) * trill * a;
          L[i] += v * gl;
          R[i] += v * gr;
        }
      }
    });
    const s = loopNode(ctx, crickets);
    s.connect(out);
    const bed = loopNode(ctx, brownBuffer(ctx));
    const g = ctx.createGain();
    g.gain.value = 0.18;
    bed.connect(g).connect(out);
    stoppers.push(s, bed);
  } else if (id === 'piano') {
    const verb = getReverb(ctx);
    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    const send = ctx.createGain();
    send.gain.value = 0.55;
    dry.connect(out);
    dry.connect(send).connect(verb);
    // escala pentatônica de Lá menor, notas espaçadas e sem repetição mecânica
    const scale = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
    let idx = 4;
    const strike = (n: number, t0: number, vel: number) => {
      const f = midi(n);
      [1, 2, 3, 4.01, 5.02].forEach((h, k) => {
        const o = ctx.createOscillator();
        o.frequency.value = f * h;
        const g = ctx.createGain();
        const a = (vel * 0.16) / Math.pow(k + 1, 1.7);
        const dec = 3.4 / (1 + k * 0.7);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(a, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dec);
        o.connect(g).connect(dry);
        o.start(t0);
        o.stop(t0 + dec + 0.05);
      });
    };
    let alive = true;
    const step = () => {
      if (!alive) return;
      idx = Math.max(0, Math.min(scale.length - 1, idx + Math.round(rand(3, -3))));
      const now = ctx.currentTime + 0.05;
      strike(scale[idx], now, rand(1, 0.55));
      if (Math.random() < 0.35) strike(scale[Math.max(0, idx - 3)] - 12, now + 0.02, 0.6);
      timer = window.setTimeout(step, rand(3400, 1300));
    };
    let timer = window.setTimeout(step, 200);
    stoppers.push({ stop: () => { alive = false; window.clearTimeout(timer); } });
  } else if (id === 'pads') {
    const verb = getReverb(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    const send = ctx.createGain();
    send.gain.value = 0.7;
    lp.connect(g).connect(out);
    g.connect(send).connect(verb);
    const chords = [[45, 52, 60, 64], [41, 48, 57, 64], [48, 55, 59, 64], [43, 50, 59, 62]];
    let c = 0;
    let alive = true;
    const play = () => {
      if (!alive) return;
      const t0 = ctx.currentTime + 0.05;
      const dur = 13;
      chords[c % chords.length].forEach((n) => {
        [-5, 5].forEach((cents) => {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = midi(n) * Math.pow(2, cents / 1200);
          const a = ctx.createGain();
          a.gain.setValueAtTime(0, t0);
          a.gain.linearRampToValueAtTime(0.075, t0 + 4);
          a.gain.setValueAtTime(0.075, t0 + dur - 4);
          a.gain.linearRampToValueAtTime(0, t0 + dur);
          o.connect(a).connect(lp);
          o.start(t0);
          o.stop(t0 + dur + 0.1);
        });
      });
      c++;
      timer = window.setTimeout(play, (dur - 4) * 1000);
    };
    let timer = window.setTimeout(play, 100);
    stoppers.push(lfo(ctx, lp.frequency, 0.05, 350), { stop: () => { alive = false; window.clearTimeout(timer); } });
  } else if (id === 'lofi') {
    const trim = ctx.createGain();
    trim.gain.value = 0.9;
    trim.connect(out);
    let src: AudioBufferSourceNode | null = null;
    let cancelled = false;
    void renderLofi(ctx.sampleRate).then((b) => {
      if (cancelled) return;
      src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;
      src.connect(trim);
      src.start();
    });
    stoppers.push({ stop: () => { cancelled = true; src?.stop(); } });
  }
  return stopAll;
}

let lofiPromise: Promise<AudioBuffer> | null = null;

/** Laço lo-fi original: acordes suaves, bumbo e chimbal discretos, chiado de vinil. */
function renderLofi(sr: number) {
  if (lofiPromise) return lofiPromise;
  const bpm = 74, beat = 60 / bpm, bars = 8, dur = bars * 4 * beat;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const lp = oc.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  lp.connect(oc.destination);
  const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [52, 55, 59, 62]];
  const roots = [33, 29, 36, 28];
  const note = (f: number, t: number, len: number, a: number, type: OscillatorType) => {
    const o = oc.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const noise = oc.createBuffer(1, sr, sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  for (let b = 0; b < bars; b++) {
    const t0 = b * 4 * beat;
    const c = chords[b % 4];
    [0, 1.5, 2.5].forEach((p) => c.forEach((n) => note(midi(n), t0 + p * beat + Math.random() * 0.012, beat * 1.6, 0.05, 'triangle')));
    note(midi(roots[b % 4] + 12), t0, beat * 1.8, 0.2, 'sine');
    note(midi(roots[b % 4] + 12), t0 + 2.5 * beat, beat * 1.2, 0.16, 'sine');
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      if (q === 0 || q === 2) {
        const o = oc.createOscillator();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
        const g = oc.createGain();
        g.gain.setValueAtTime(0.32, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g).connect(oc.destination);
        o.start(t);
        o.stop(t + 0.3);
      }
      for (let e = 0; e < 2; e++) {
        const tt = t + (e * beat) / 2 + (e ? beat * 0.06 : 0);
        const s = oc.createBufferSource();
        s.buffer = noise;
        const hp = oc.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6500;
        const g = oc.createGain();
        g.gain.setValueAtTime(q % 2 && !e ? 0.05 : 0.028, tt);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
        s.connect(hp).connect(g).connect(oc.destination);
        s.start(tt, Math.random() * 0.8);
        s.stop(tt + 0.07);
      }
    }
  }
  lofiPromise = oc.startRendering().then((b) => {
    // chiado e estalos de vinil
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] += (Math.random() * 2 - 1) * 0.0035;
      for (let k = 0; k < 90; k++) d[Math.floor(Math.random() * d.length)] += rand(0.12, -0.12);
    }
    return b;
  });
  return lofiPromise;
}

/** Aplica o estado: liga/desliga camadas e ajusta volumes. */
function sync() {
  const s = ambientStore.get();
  if (!s.on) {
    if (bus) {
      const ctx = bus.context as AudioContext;
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      const stop = [...running.values()];
      running.clear();
      window.setTimeout(() => stop.forEach((r) => { r.stop(); r.gain.disconnect(); }), 1200);
    }
    return;
  }
  const { ctx } = getAudio();
  const b = ensureBus(ctx);
  const interrupted = playingOwnerStore.get() != null;
  b.gain.setTargetAtTime(interrupted ? 0 : Math.pow(s.master, 1.6) * 0.75, ctx.currentTime, interrupted ? 0.04 : 0.6);
  for (const { id } of LAYERS) {
    const level = s.levels[id] ?? 0;
    const r = running.get(id);
    if (level > 0.001 && !r) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(b);
      const stop = buildLayer(id, ctx, gain);
      gain.gain.setTargetAtTime(level, ctx.currentTime, 0.5);
      running.set(id, { gain, stop });
    } else if (r && level > 0.001) {
      r.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
    } else if (r) {
      r.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      running.delete(id);
      window.setTimeout(() => { r.stop(); r.gain.disconnect(); }, 1200);
    }
  }
}

ambientStore.subscribe(sync);
// silencia enquanto um experimento toca e retoma quando ele termina
playingOwnerStore.subscribe(() => {
  if (ambientStore.get().on) sync();
});
