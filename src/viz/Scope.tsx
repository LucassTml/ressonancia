import { useRef } from 'react';
import { useAnimationFrame, useInView } from '../lib/hooks';
import { setupCanvas, useThemeColors, withAlpha } from '../lib/themeColors';

/**
 * Osciloscópio e analisador de espectro alimentados por um AnalyserNode real.
 * O osciloscópio sincroniza (trigger) na passagem ascendente por zero, para
 * que formas de onda periódicas fiquem paradas na tela.
 */
export function Scope({
  analyser,
  mode,
  height = 160,
  label,
  fMin = 20,
  fMax = 20000,
  dbMin = -100,
  dbMax = -10,
  timeSpan,
  color,
}: {
  analyser: AnalyserNode | null;
  mode: 'time' | 'spectrum';
  height?: number;
  label?: string;
  fMin?: number;
  fMax?: number;
  dbMin?: number;
  dbMax?: number;
  /** segundos exibidos no osciloscópio */
  timeSpan?: number;
  color?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [wrap, inView] = useInView<HTMLDivElement>();
  const colors = useThemeColors();
  const buf = useRef<Float32Array<ArrayBuffer> | null>(null);
  const smooth = useRef<Float32Array | null>(null);

  useAnimationFrame(() => {
    const c = ref.current;
    if (!c) return;
    const { g, w, h } = setupCanvas(c);
    g.clearRect(0, 0, w, h);
    const stroke = color ?? colors.accent;

    // grade
    g.strokeStyle = colors.grid;
    g.lineWidth = 1;
    if (mode === 'time') {
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(0, (h * i) / 4);
        g.lineTo(w, (h * i) / 4);
        g.stroke();
      }
      for (let i = 1; i < 10; i++) {
        g.beginPath();
        g.moveTo((w * i) / 10, 0);
        g.lineTo((w * i) / 10, h);
        g.stroke();
      }
    } else {
      const lr = Math.log(fMax / fMin);
      g.fillStyle = colors.faint;
      g.font = '10px Inter Variable, sans-serif';
      g.textAlign = 'center';
      for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
        if (f <= fMin || f >= fMax) continue;
        const x = (Math.log(f / fMin) / lr) * w;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h - 14);
        g.stroke();
        g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, h - 3);
      }
    }

    if (!analyser) {
      g.fillStyle = colors.faint;
      g.font = '12px Inter Variable, sans-serif';
      g.textAlign = 'center';
      g.fillText('aguardando sinal', w / 2, h / 2);
      return;
    }

    if (mode === 'time') {
      const n = analyser.fftSize;
      if (!buf.current || buf.current.length !== n) buf.current = new Float32Array(n);
      analyser.getFloatTimeDomainData(buf.current);
      const d = buf.current;
      const sr = analyser.context.sampleRate;
      const span = Math.min(n * 0.5, Math.round((timeSpan ?? 0.01) * sr));
      // trigger
      let start = 0;
      for (let i = 1; i < n - span; i++) {
        if (d[i - 1] < 0 && d[i] >= 0) {
          start = i;
          break;
        }
      }
      g.strokeStyle = stroke;
      g.lineWidth = 1.8;
      g.beginPath();
      for (let i = 0; i < span; i++) {
        const x = (i / (span - 1)) * w;
        const y = h / 2 - d[start + i] * (h / 2 - 6);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    } else {
      const bins = analyser.frequencyBinCount;
      if (!buf.current || buf.current.length !== bins) buf.current = new Float32Array(bins);
      if (!smooth.current || smooth.current.length !== bins) smooth.current = new Float32Array(bins).fill(dbMin);
      analyser.getFloatFrequencyData(buf.current);
      const sr = analyser.context.sampleRate;
      const lr = Math.log(fMax / fMin);
      const ph = h - 14;
      g.beginPath();
      let first = true;
      for (let k = 1; k < bins; k++) {
        const f = (k * sr) / analyser.fftSize;
        if (f < fMin || f > fMax) continue;
        const v = buf.current[k];
        smooth.current[k] = Math.max(v, smooth.current[k] - 1.2);
        const x = (Math.log(f / fMin) / lr) * w;
        const y = ph - ((Math.max(dbMin, Math.min(dbMax, smooth.current[k])) - dbMin) / (dbMax - dbMin)) * ph;
        if (first) {
          g.moveTo(x, ph);
          g.lineTo(x, y);
          first = false;
        } else g.lineTo(x, y);
      }
      g.lineTo(w, ph);
      g.closePath();
      g.fillStyle = withAlpha(stroke, 0.14);
      g.fill();
      g.strokeStyle = stroke;
      g.lineWidth = 1.4;
      g.stroke();
    }
  }, inView);

  return (
    <div ref={wrap} className="relative">
      {label && <div className="absolute left-2 top-1.5 text-[10.5px] uppercase tracking-[0.1em] text-faint font-medium pointer-events-none">{label}</div>}
      <canvas ref={ref} className="w-full block rounded-lg bg-sunken" style={{ height }} />
    </div>
  );
}
