import { createPersistentStore } from '../lib/storage';
import { renderExtraDemo, type DemoId } from './demos';

/**
 * Motor de áudio compartilhado.
 *
 * - Um único AudioContext, criado apenas após um gesto do usuário (nunca há
 *   reprodução automática).
 * - Toda saída passa por: volume mestre → limitador de segurança → destino.
 *   O limitador evita picos acima de ~-3 dBFS mesmo se um experimento somar
 *   sinais ou aplicar ganho excessivo.
 * - Apenas um experimento toca por vez: ao iniciar um som, o anterior para.
 */

export const masterVolumeStore = createPersistentStore<number>('master-volume', 0.35);
export const playingOwnerStore = createPersistentStore<string | null>('__playing', null);
// o "dono" atual não deve persistir entre sessões
playingOwnerStore.set(null);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let currentStop: (() => void) | null = null;
let currentOwner: string | null = null;

export function getAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = masterVolumeStore.get();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    masterVolumeStore.subscribe(() => {
      if (master && ctx) master.gain.setTargetAtTime(masterVolumeStore.get(), ctx.currentTime, 0.03);
    });
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

/** Registra um som em reprodução; interrompe o anterior. */
export function claimPlayback(owner: string, stop: () => void) {
  if (currentStop && currentOwner !== owner) {
    const s = currentStop;
    currentStop = null;
    s();
  }
  currentOwner = owner;
  currentStop = stop;
  playingOwnerStore.set(owner);
}

export function releasePlayback(owner: string) {
  if (currentOwner === owner) {
    currentOwner = null;
    currentStop = null;
    playingOwnerStore.set(null);
  }
}

export function stopAll() {
  if (currentStop) {
    const s = currentStop;
    currentStop = null;
    s();
  }
  currentOwner = null;
  playingOwnerStore.set(null);
}

export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const gainToDb = (g: number) => 20 * Math.log10(Math.max(g, 1e-12));

/** Rampa suave para evitar cliques. */
export function rampTo(param: AudioParam, value: number, ctx: BaseAudioContext, time = 0.02) {
  param.cancelScheduledValues(ctx.currentTime);
  param.setTargetAtTime(value, ctx.currentTime, time);
}

/* ------------------------------------------------------------------ */
/* Fontes de sinal                                                     */
/* ------------------------------------------------------------------ */

const bufferCache = new Map<string, AudioBuffer>();

/** Ruído rosa (−3 dB/oitava) pelo filtro de Paul Kellet, normalizado a ~−12 dBFS RMS. */
export function pinkNoiseBuffer(ctx: BaseAudioContext, seconds = 6) {
  const key = `pink-${ctx.sampleRate}-${seconds}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      const v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
      d[i] = v;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / n);
    const g = 0.25 / rms;
    for (let i = 0; i < n; i++) d[i] *= g;
    crossfadeLoop(d, Math.floor(ctx.sampleRate * 0.05));
  }
  bufferCache.set(key, buf);
  return buf;
}

export function whiteNoiseBuffer(ctx: BaseAudioContext, seconds = 4) {
  const key = `white-${ctx.sampleRate}-${seconds}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.43; // ~−12 dBFS RMS
    crossfadeLoop(d, Math.floor(ctx.sampleRate * 0.05));
  }
  bufferCache.set(key, buf);
  return buf;
}

function crossfadeLoop(d: Float32Array, len: number) {
  // suaviza a emenda do loop
  const n = d.length;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    d[n - len + i] = d[n - len + i] * (1 - t) + d[i] * t;
  }
}

/* ------------------------------------------------------------------ */
/* Música de demonstração (sintetizada no navegador, composição própria)*/
/* ------------------------------------------------------------------ */

/** Trecho de demonstração escolhido; vale para todos os laboratórios. */
export const demoIdStore = createPersistentStore<DemoId>('demo-id', 'band');
const demoPromises = new Map<string, Promise<AudioBuffer>>();

/**
 * Renderiza um trecho musical original de ~12 s com bumbo, caixa, chimbal,
 * baixo, acordes, melodia e uma "voz" com formantes. Ocupa o espectro inteiro,
 * o que o torna útil para ouvir equalizações. Gerado com OfflineAudioContext.
 */
export function demoMusicBuffer(sampleRate: number, id: DemoId = demoIdStore.get()): Promise<AudioBuffer> {
  let p = demoPromises.get(id);
  if (!p) {
    p = id === 'band' ? renderDemo(sampleRate) : renderExtraDemo(id, sampleRate);
    demoPromises.set(id, p);
  }
  return p;
}

async function renderDemo(sampleRate: number) {
  const bpm = 92;
  const beat = 60 / bpm;
  const bars = 4;
  const dur = bars * 4 * beat;
  const oc = new OfflineAudioContext(2, Math.ceil((dur + 0.01) * sampleRate), sampleRate);
  const bus = oc.createGain();
  bus.gain.value = 0.8;
  bus.connect(oc.destination);

  const noise = whiteNoiseBuffer(oc, 2);
  const panned = (pan: number) => {
    const p = oc.createStereoPanner();
    p.pan.value = pan;
    p.connect(bus);
    return p;
  };

  // Bumbo: senoide com varredura de altura
  const kickOut = panned(0);
  const kick = (t: number) => {
    const o = oc.createOscillator();
    const g = oc.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(kickOut);
    o.start(t);
    o.stop(t + 0.5);
  };
  // Caixa: ruído filtrado + corpo tonal
  const snareOut = panned(0.05);
  const snare = (t: number) => {
    const s = oc.createBufferSource();
    s.buffer = noise;
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.6;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    s.connect(bp).connect(g).connect(snareOut);
    s.start(t, Math.random());
    s.stop(t + 0.25);
    const o = oc.createOscillator();
    const og = oc.createGain();
    o.frequency.value = 185;
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(snareOut);
    o.start(t);
    o.stop(t + 0.15);
  };
  // Chimbal: ruído passa-altas curto
  const hatOut = panned(-0.35);
  const hat = (t: number, open = false) => {
    const s = oc.createBufferSource();
    s.buffer = noise;
    const hp = oc.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const pk = oc.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 10000;
    pk.gain.value = 6;
    const g = oc.createGain();
    const len = open ? 0.28 : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(hp).connect(pk).connect(g).connect(hatOut);
    s.start(t, Math.random());
    s.stop(t + len + 0.02);
  };

  const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

  // Progressão: Am – F – C – G (graus vi–IV–I–V em Dó maior)
  const chords = [
    [57, 60, 64],
    [53, 57, 60],
    [55, 60, 64],
    [55, 59, 62],
  ];
  const roots = [45, 41, 48, 43];

  // Baixo: dente-de-serra filtrado
  const bassOut = panned(0);
  const bassNote = (t: number, n: number, len: number) => {
    const o = oc.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(n);
    const lp = oc.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + len);
    lp.Q.value = 2;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
    g.gain.setTargetAtTime(0.0001, t + len * 0.85, 0.03);
    o.connect(lp).connect(g).connect(bassOut);
    o.start(t);
    o.stop(t + len + 0.2);
  };

  // Pad: dentes-de-serra desafinados em leque estéreo
  const pad = (t: number, notes: number[], len: number) => {
    notes.forEach((n, i) => {
      [-7, 7].forEach((cents, k) => {
        const o = oc.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n + 12) * Math.pow(2, cents / 1200);
        const lp = oc.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2200;
        const g = oc.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.032, t + 0.25);
        g.gain.setValueAtTime(0.032, t + len - 0.2);
        g.gain.linearRampToValueAtTime(0.0001, t + len);
        const p = oc.createStereoPanner();
        p.pan.value = (k === 0 ? -1 : 1) * (0.3 + i * 0.15);
        o.connect(lp).connect(g).connect(p).connect(bus);
        o.start(t);
        o.stop(t + len + 0.05);
      });
    });
  };

  // Melodia: triângulo com vibrato, ligeiramente à direita
  const leadOut = panned(0.25);
  const lead = (t: number, n: number, len: number) => {
    const o = oc.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(n);
    const vib = oc.createOscillator();
    vib.frequency.value = 5.2;
    const vg = oc.createGain();
    vg.gain.value = midi(n) * 0.006;
    vib.connect(vg).connect(o.frequency);
    const o2 = oc.createOscillator();
    o2.type = 'square';
    o2.frequency.value = midi(n);
    const g2 = oc.createGain();
    g2.gain.value = 0.25;
    const lp = oc.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    g.gain.setTargetAtTime(0.09, t + 0.05, 0.1);
    g.gain.setTargetAtTime(0.0001, t + len * 0.9, 0.04);
    o.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(g).connect(leadOut);
    [o, o2, vib].forEach((x) => {
      x.start(t);
      x.stop(t + len + 0.3);
    });
  };

  // "Voz": pulso rico filtrado por formantes de vogal (a/é/o)
  const voxOut = panned(-0.1);
  const vowels: Record<string, [number, number, number]> = {
    a: [800, 1150, 2900],
    e: [400, 2000, 2600],
    o: [450, 800, 2830],
  };
  const vox = (t: number, n: number, len: number, v: keyof typeof vowels) => {
    const o = oc.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(n);
    const vib = oc.createOscillator();
    vib.frequency.value = 5.6;
    const vg = oc.createGain();
    vg.gain.value = midi(n) * 0.008;
    vib.connect(vg).connect(o.frequency);
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
    g.gain.setTargetAtTime(0.0001, t + len * 0.85, 0.06);
    const sum = oc.createGain();
    sum.gain.value = 0.6;
    vowels[v].forEach((f, i) => {
      const bp = oc.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 9 + i * 3;
      const fg = oc.createGain();
      fg.gain.value = [1, 0.6, 0.35][i];
      o.connect(bp).connect(fg).connect(g);
    });
    g.connect(sum).connect(voxOut);
    [o, vib].forEach((x) => {
      x.start(t);
      x.stop(t + len + 0.3);
    });
  };

  const melody: [number, number, number][] = [
    // [compasso, tempo dentro do compasso (beats), nota]
    [0, 0, 76], [0, 1, 74], [0, 1.5, 72], [0, 2, 74], [0, 3, 76],
    [1, 0, 77], [1, 1, 76], [1, 2, 72], [1, 3, 69],
    [2, 0, 72], [2, 1, 74], [2, 1.5, 76], [2, 2, 79], [2, 3, 76],
    [3, 0, 74], [3, 1, 71], [3, 2, 74], [3, 3, 67],
  ];

  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      if (b === 0 || b === 2) kick(t);
      if (b === 2 && bar % 2 === 1) kick(t + beat * 0.5);
      if (b === 1 || b === 3) snare(t);
      for (let s = 0; s < 2; s++) hat(t + s * beat * 0.5, b === 3 && s === 1);
      bassNote(t, roots[bar], beat * 0.48);
      bassNote(t + beat * 0.5, roots[bar] + (b === 3 ? 7 : 12), beat * 0.4);
    }
    pad(t0, chords[bar], 4 * beat);
    if (bar % 2 === 0) vox(t0 + 0.02, chords[bar][1] , beat * 1.9, bar === 0 ? 'a' : 'o');
    else vox(t0 + 0.02, chords[bar][2] , beat * 1.9, 'e');
  }
  melody.forEach(([bar, pos, n], i) => {
    const next = melody[i + 1];
    const tAbs = (bar * 4 + pos) * beat;
    const tNext = next ? (next[0] * 4 + next[1]) * beat : dur;
    lead(tAbs, n, Math.max(0.15, tNext - tAbs));
  });

  const buf = await oc.startRendering();
  // normaliza para pico de −3 dBFS
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const g = 0.7 / (peak || 1);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  return buf;
}

export async function decodeFile(file: File): Promise<AudioBuffer> {
  const { ctx } = getAudio();
  const data = await file.arrayBuffer();
  return ctx.decodeAudioData(data);
}
