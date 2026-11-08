/**
 * Trechos curtos de demonstração, compostos e sintetizados no navegador.
 * Cada um destaca algo diferente do som: ataques, vozes, cordas, transientes.
 */

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function finish(buf: AudioBuffer) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const g = 0.7 / (peak || 1);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
  return buf;
}

function makeReverb(oc: OfflineAudioContext, seconds: number, bus: AudioNode, level: number) {
  const n = Math.floor(oc.sampleRate * seconds);
  const ir = oc.createBuffer(2, n, oc.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.5);
  }
  const conv = oc.createConvolver();
  conv.buffer = ir;
  const g = oc.createGain();
  g.gain.value = level;
  conv.connect(g).connect(bus);
  return conv;
}

async function renderPiano(sr: number) {
  const beat = 0.5, bars = 6, dur = bars * 4 * beat + 2;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const verb = makeReverb(oc, 2, oc.destination, 0.35);
  const key = (n: number, t: number, v: number) => {
    const f = midi(n);
    const p = oc.createStereoPanner();
    p.pan.value = Math.max(-0.7, Math.min(0.7, (n - 60) / 30));
    p.connect(oc.destination);
    p.connect(verb);
    [1, 2.001, 3.004, 4.01, 5.02, 6.04, 7.08].forEach((h, k) => {
      if (f * h > sr / 2.2) return;
      const o = oc.createOscillator();
      o.frequency.value = f * h;
      const g = oc.createGain();
      const dec = (2.8 * Math.pow(220 / f, 0.35)) / (1 + k * 0.55);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((v * 0.2) / Math.pow(k + 1, 1.25), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + dec + 0.02);
    });
  };
  const prog = [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62], [45, 57, 60, 64], [40, 56, 59, 64]];
  const tune = [76, 72, 74, 76, 77, 76, 72, 69, 72, 74, 76, 79, 79, 76, 74, 71, 76, 72, 69, 72, 71, 68, 71, 76];
  prog.forEach((c, b) => {
    const t0 = b * 4 * beat;
    key(c[0], t0, 0.9);
    for (let q = 0; q < 8; q++) key(c[1 + (q % 3)], t0 + (q * beat) / 2, 0.42);
    for (let q = 0; q < 4; q++) key(tune[b * 4 + q], t0 + q * beat, 0.8);
  });
  return finish(await oc.startRendering());
}

async function renderStrings(sr: number) {
  const barLen = 2.6, bars = 5, dur = barLen * bars + 1.5;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const verb = makeReverb(oc, 2.6, oc.destination, 0.4);
  const voice = (n: number, t: number, len: number, pan: number, a: number) => {
    for (const cents of [-6, 4]) {
      const o = oc.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n) * Math.pow(2, cents / 1200);
      const vib = oc.createOscillator();
      vib.frequency.value = 5 + Math.random();
      const vg = oc.createGain();
      vg.gain.value = midi(n) * 0.005;
      vib.connect(vg).connect(o.frequency);
      const body = oc.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 2800;
      body.gain.value = 5;
      const lp = oc.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 6500;
      const g = oc.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(a, t + 0.35);
      g.gain.setValueAtTime(a, t + len - 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.1);
      const p = oc.createStereoPanner();
      p.pan.value = pan;
      o.connect(body).connect(lp).connect(g).connect(p);
      p.connect(oc.destination);
      p.connect(verb);
      [o, vib].forEach((x) => {
        x.start(t);
        x.stop(t + len + 0.2);
      });
    }
  };
  const ch = [[36, 55, 64, 72], [41, 57, 65, 72], [43, 59, 67, 74], [40, 55, 64, 76], [36, 52, 67, 72]];
  ch.forEach((c, b) => {
    const t = b * barLen;
    voice(c[0], t, barLen, 0.45, 0.07);
    voice(c[1], t, barLen, 0.2, 0.05);
    voice(c[2], t, barLen, -0.2, 0.05);
    voice(c[3], t, barLen, -0.5, 0.06);
  });
  return finish(await oc.startRendering());
}

/** Violão por Karplus-Strong: um atraso realimentado imita a corda dedilhada. */
async function renderGuitar(sr: number, ctxFactory: (ch: number, n: number) => AudioBuffer) {
  const beat = 0.36, bars = 6, dur = bars * 6 * beat + 2.5;
  const buf = ctxFactory(2, Math.ceil(dur * sr));
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const pluck = (n: number, t: number, a: number, pan: number) => {
    const per = Math.round(sr / midi(n));
    const line = new Float32Array(per);
    let prevN = 0;
    for (let i = 0; i < per; i++) {
      const w = Math.random() * 2 - 1;
      line[i] = (w + prevN) / 2;
      prevN = w;
    }
    const len = Math.floor(sr * 2.4);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
    const at = Math.floor(t * sr);
    let idx = 0;
    for (let i = 0; i < len && at + i < L.length; i++) {
      const next = (idx + 1) % per;
      const v = line[idx];
      line[idx] = 0.996 * 0.5 * (line[idx] + line[next]);
      idx = next;
      L[at + i] += v * a * gl;
      R[at + i] += v * a * gr;
    }
  };
  const chords = [[40, 52, 59, 64, 67, 71], [36, 52, 60, 64, 67, 72], [43, 55, 59, 62, 67, 71], [38, 50, 57, 62, 66, 69], [40, 52, 59, 64, 67, 71], [47, 54, 59, 63, 66, 71]];
  const pattern = [0, 3, 4, 5, 4, 3];
  chords.forEach((c, b) => {
    pattern.forEach((p, q) => pluck(c[p], b * 6 * beat + q * beat + Math.random() * 0.008, q === 0 ? 0.5 : 0.32, -0.3 + p * 0.12));
    pluck(c[1], b * 6 * beat + 3 * beat, 0.3, -0.1);
  });
  return finish(buf);
}

async function renderVoices(sr: number) {
  const beat = 0.8, dur = 16 * beat + 1.5;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const verb = makeReverb(oc, 2.8, oc.destination, 0.45);
  const vowels: [number, number, number][] = [
    [800, 1150, 2900],
    [400, 2000, 2600],
    [350, 2200, 2900],
    [450, 800, 2830],
    [325, 700, 2530],
  ];
  const sing = (n: number, t: number, len: number, v: number, pan: number, a: number) => {
    const o = oc.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(n);
    const vib = oc.createOscillator();
    vib.frequency.value = 5.4;
    const vg = oc.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(midi(n) * 0.012, t + 0.5);
    vib.connect(vg).connect(o.frequency);
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(a, t + 0.12);
    g.gain.setValueAtTime(a, t + len - 0.12);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    const p = oc.createStereoPanner();
    p.pan.value = pan;
    p.connect(oc.destination);
    p.connect(verb);
    vowels[v].forEach((f, i) => {
      const bp = oc.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 8 + i * 3;
      const fg = oc.createGain();
      fg.gain.value = [1, 0.55, 0.3][i];
      o.connect(bp).connect(fg).connect(g);
    });
    g.connect(p);
    [o, vib].forEach((x) => {
      x.start(t);
      x.stop(t + len + 0.1);
    });
  };
  const lead = [69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 69];
  lead.forEach((n, i) => sing(n, i * beat, beat * 0.98, i % 5, 0, 1));
  [45, 43, 41, 40].forEach((n, b) => {
    sing(n + 12, b * 4 * beat, 4 * beat, 3, -0.5, 0.55);
    sing(n + 19, b * 4 * beat, 4 * beat, 4, 0.5, 0.45);
  });
  return finish(await oc.startRendering());
}

async function renderDrums(sr: number) {
  const beat = 60 / 112, bars = 4, dur = bars * 4 * beat;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const noise = oc.createBuffer(1, sr, sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  const hit = (t: number, type: BiquadFilterType, f: number, q: number, a: number, len: number, pan: number) => {
    const s = oc.createBufferSource();
    s.buffer = noise;
    const flt = oc.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    flt.Q.value = q;
    const g = oc.createGain();
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const p = oc.createStereoPanner();
    p.pan.value = pan;
    s.connect(flt).connect(g).connect(p).connect(oc.destination);
    s.start(t, Math.random() * 0.8);
    s.stop(t + len + 0.02);
  };
  const tone = (t: number, f0: number, f1: number, a: number, len: number) => {
    const o = oc.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.4);
    const g = oc.createGain();
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(oc.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const bass = (t: number, n: number, len: number) => {
    const o = oc.createOscillator();
    o.type = 'square';
    o.frequency.value = midi(n);
    const lp = oc.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(lp).connect(g).connect(oc.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  };
  const line = [33, 33, 45, 33, 36, 33, 43, 40];
  for (let b = 0; b < bars; b++) {
    for (let e = 0; e < 8; e++) {
      const t = (b * 4 + e / 2) * beat;
      if (e === 0 || e === 3 || e === 5) tone(t, 150, 44, 0.95, 0.32);
      if (e === 2 || e === 6) {
        tone(t, 210, 170, 0.32, 0.12);
        hit(t, 'bandpass', 2200, 0.7, 0.75, 0.2, 0.08);
      }
      hit(t, 'highpass', 7500, 0.7, e % 2 ? 0.14 : 0.26, e === 7 ? 0.25 : 0.05, -0.3);
      bass(t, line[e], beat * 0.45);
    }
    if (b === bars - 1) [0, 1, 2].forEach((k) => hit((b * 4 + 3 + k / 3) * beat, 'bandpass', 900 - k * 200, 2, 0.6, 0.14, 0.4 - k * 0.4));
  }
  return finish(await oc.startRendering());
}

async function renderJazz(sr: number) {
  const beat = 60 / 132, bars = 8, dur = bars * 4 * beat + 1;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const verb = makeReverb(oc, 1.2, oc.destination, 0.18);
  const noise = oc.createBuffer(1, sr, sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  const upright = (t: number, n: number) => {
    const o = oc.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(n);
    const g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.3);
    o.connect(g).connect(oc.destination);
    o.start(t);
    o.stop(t + beat * 1.4);
  };
  const ep = (t: number, n: number, a: number, pan: number) => {
    const p = oc.createStereoPanner();
    p.pan.value = pan;
    p.connect(oc.destination);
    p.connect(verb);
    [1, 2, 7].forEach((h, k) => {
      const o = oc.createOscillator();
      o.frequency.value = midi(n) * h;
      const g = oc.createGain();
      const len = [1.3, 0.8, 0.12][k];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a * [0.16, 0.05, 0.05][k], t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + len + 0.02);
    });
  };
  const ride = (t: number, a: number) => {
    const s = oc.createBufferSource();
    s.buffer = noise;
    const hp = oc.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 8200;
    hp.Q.value = 1.2;
    const g = oc.createGain();
    g.gain.setValueAtTime(a, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    const p = oc.createStereoPanner();
    p.pan.value = 0.4;
    s.connect(hp).connect(g).connect(p).connect(oc.destination);
    s.start(t, Math.random() * 0.6);
    s.stop(t + 0.32);
  };
  // ii–V–I–VI em Dó, baixo caminhante
  const chords = [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 61, 64, 67]];
  const walks = [[38, 41, 45, 47], [43, 47, 50, 49], [36, 40, 43, 44], [45, 49, 52, 37]];
  for (let b = 0; b < bars; b++) {
    const c = b % 4;
    for (let q = 0; q < 4; q++) {
      const t = (b * 4 + q) * beat;
      upright(t, walks[c][q]);
      ride(t, 0.13);
      if (q === 1 || q === 3) ride(t + beat * 0.66, 0.08);
    }
    const stab = (b * 4 + (b % 2 ? 1.66 : 0.66)) * beat;
    chords[c].forEach((n, i) => ep(stab, n + 12, 0.75, -0.3 + i * 0.1));
    ep((b * 4 + 2.66) * beat, chords[c][3] + 24, 0.7, 0.3);
  }
  return finish(await oc.startRendering());
}

export type DemoId = 'band' | 'piano' | 'strings' | 'guitar' | 'voices' | 'drums' | 'jazz';

export function renderExtraDemo(id: Exclude<DemoId, 'band'>, sr: number): Promise<AudioBuffer> {
  switch (id) {
    case 'piano':
      return renderPiano(sr);
    case 'strings':
      return renderStrings(sr);
    case 'guitar':
      return renderGuitar(sr, (ch, n) => new AudioBuffer({ numberOfChannels: ch, length: n, sampleRate: sr }));
    case 'voices':
      return renderVoices(sr);
    case 'drums':
      return renderDrums(sr);
    case 'jazz':
      return renderJazz(sr);
  }
}
