import { useEffect, useRef } from 'react';
import { usePlayback } from './ui/audio';
import { useInView, usePrefersReducedMotion } from '../lib/hooks';
import { tr, NOTE_NAMES } from '../i18n';

// escala pentatônica de Lá menor: qualquer posição do ponteiro soa bem
const SCALE = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
const noteAt = (x: number) => SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.floor(x * SCALE.length)))];
const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Pointer {
  x: number;
  y: number;
  inside: boolean;
}

/** Sintetizador tocado pela onda: x escolhe a nota, y o brilho e o volume. */
export function useWaveSynth() {
  const pb = usePlayback('hero');
  const nodes = useRef<{ ctx: AudioContext; a: OscillatorNode; b: OscillatorNode; lp: BiquadFilterNode; g: GainNode } | null>(null);

  const start = () =>
    pb.start((ctx, out) => {
      const master = ctx.createGain();
      master.gain.value = 0.5;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      lp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.value = 0;
      const a = ctx.createOscillator();
      a.type = 'sawtooth';
      const b = ctx.createOscillator();
      b.type = 'triangle';
      b.detune.value = 6;
      const ag = ctx.createGain();
      ag.gain.value = 0.35;
      a.connect(ag).connect(lp);
      b.connect(lp);
      lp.connect(g).connect(master).connect(out);
      // eco suave, para a nota não morrer seca
      const dl = ctx.createDelay(1);
      dl.delayTime.value = 0.31;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      g.connect(dl).connect(fb).connect(dl);
      dl.connect(wet).connect(master);
      a.start();
      b.start();
      nodes.current = { ctx, a, b, lp, g };
      return () => {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.05);
        master.gain.setTargetAtTime(0, t + 0.1, 0.1);
        window.setTimeout(() => {
          a.stop();
          b.stop();
          master.disconnect();
        }, 700);
        nodes.current = null;
      };
    });

  const update = (p: Pointer) => {
    const n = nodes.current;
    if (!n) return;
    const t = n.ctx.currentTime;
    const f = midiHz(noteAt(p.x));
    n.a.frequency.setTargetAtTime(f, t, 0.025);
    n.b.frequency.setTargetAtTime(f, t, 0.025);
    const bright = 1 - Math.max(0, Math.min(1, p.y));
    n.lp.frequency.setTargetAtTime(250 * Math.pow(26, bright), t, 0.04);
    n.g.gain.setTargetAtTime(p.inside ? 0.12 + bright * 0.3 : 0, t, p.inside ? 0.05 : 0.18);
  };

  const pluck = () => {
    const n = nodes.current;
    if (!n) return;
    const t = n.ctx.currentTime;
    const v = n.g.gain.value;
    n.g.gain.cancelScheduledValues(t);
    n.g.gain.setValueAtTime(Math.min(0.75, v + 0.32), t);
    n.g.gain.setTargetAtTime(v, t + 0.02, 0.16);
  };

  return { on: pb.playing, start, stop: pb.stop, update, pluck };
}

export type WaveSynth = ReturnType<typeof useWaveSynth>;

/** Linhas de onda que se somam suavemente — e que podem ser tocadas. */
export function HeroWave({ synth }: { synth: WaveSynth }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>('0px');
  const reduced = usePrefersReducedMotion();
  const mouse = useRef<Pointer>({ x: 0.5, y: 0.5, inside: false });
  const smooth = useRef({ x: 0.5, y: 0.5, energy: 0 });
  const ripples = useRef<{ x: number; t: number }[]>([]);
  const synthRef = useRef(synth);
  synthRef.current = synth;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue('--accent').trim() || '#5fd4c0';
      const fg = styles.getPropertyValue('--fg-faint').trim() || '#666';
      const muted = styles.getPropertyValue('--fg-muted').trim() || '#666';
      const t = reduced ? 0 : (now - t0) / 1000;
      const on = synthRef.current.on;
      const m = mouse.current, s = smooth.current;
      s.x += (m.x - s.x) * 0.14;
      s.y += (m.y - s.y) * 0.14;
      s.energy += ((on && m.inside ? 1 : 0) - s.energy) * 0.08;
      const bright = 1 - Math.max(0, Math.min(1, s.y));
      const note = noteAt(s.x);
      // a onda desenhada acompanha a nota: mais aguda = mais ciclos
      const cycles = 22 * Math.pow(2, (note - 45) / 18);
      ripples.current = ripples.current.filter((r) => now - r.t < 1400);
      const lines = 14;
      const mid = Math.floor(lines / 2);
      for (let k = 0; k < lines; k++) {
        const p = k / (lines - 1);
        const centerLine = k === mid;
        g.beginPath();
        for (let x = 0; x <= w; x += 2.5) {
          const u = x / w;
          const env = Math.sin(Math.PI * u) ** 1.5;
          const near = Math.exp(-((u - s.x) ** 2) / 0.02);
          let bump = 0;
          for (const r of ripples.current) {
            const age = (now - r.t) / 1000;
            const dist = Math.abs(u - r.x);
            const front = Math.exp(-(((dist - age * 0.45) / 0.05) ** 2));
            bump += front * Math.exp(-age * 2.4) * Math.sin(dist * 90 - age * 26);
          }
          const play = s.energy * near * (centerLine ? 1 : 0.35 * (1 - Math.abs(p - 0.5) * 1.6));
          const y =
            h * (0.5 + (p - 0.5) * 0.5) +
            env * (h * 0.08 * Math.sin(u * 9 + t * 0.6 + p * 2.2) + h * 0.045 * Math.sin(u * 17 - t * 0.9 + p * 4)) +
            near * (1 - s.energy) * h * 0.03 * Math.sin(u * 40 + t * 2.4) +
            play * h * (0.05 + bright * 0.13) * Math.sin(u * cycles + t * 9) +
            bump * h * (centerLine ? 0.09 : 0.03);
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        const center = 1 - Math.abs(p - 0.5) * 2;
        g.strokeStyle = centerLine ? accent : fg;
        g.globalAlpha = centerLine ? 0.9 : 0.12 + center * 0.22 + s.energy * 0.1;
        g.lineWidth = centerLine ? 1.6 + s.energy * 0.8 : 1;
        g.stroke();
      }
      g.globalAlpha = 1;
      if (s.energy > 0.05) {
        const f = midiHz(note);
        const label = `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1} · ${Math.round(f)} Hz`;
        g.globalAlpha = s.energy;
        g.fillStyle = muted;
        g.font = '500 12px Inter Variable, sans-serif';
        g.textAlign = s.x > 0.85 ? 'right' : 'left';
        g.fillText(label, s.x * w + (s.x > 0.85 ? -12 : 12), Math.min(h - 8, Math.max(16, s.y * h - 12)));
        g.globalAlpha = 1;
      }
      if (inView && (!reduced || on || s.energy > 0.01)) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, synth.on]);

  const locate = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, inside: true };
    synthRef.current.update(mouse.current);
  };

  return (
    <div
      ref={wrapRef}
      className={`absolute inset-0 touch-pan-y ${synth.on ? 'cursor-crosshair' : 'cursor-pointer'}`}
      onPointerMove={locate}
      onPointerDown={(e) => {
        locate(e);
        if (!synthRef.current.on) {
          synthRef.current.start();
          // o sintetizador só existe depois de iniciar; aplica a posição na sequência
          window.setTimeout(() => synthRef.current.update(mouse.current), 30);
        } else synthRef.current.pluck();
        ripples.current.push({ x: mouse.current.x, t: performance.now() });
      }}
      onPointerLeave={() => {
        mouse.current = { ...mouse.current, inside: false };
        synthRef.current.update(mouse.current);
      }}
      role="application"
      aria-label={tr('Onda interativa: clique para ligar o som e mova o ponteiro para tocar')}
    >
      <canvas ref={canvasRef} className="w-full h-full" aria-hidden />
    </div>
  );
}
